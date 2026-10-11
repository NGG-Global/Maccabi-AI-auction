-- ============================================================
-- 008 Budget-allocation game mode
-- ============================================================
-- Adds a second way to play, chosen by the facilitator before the
-- game starts:
--
--   auction     (existing) one trait per round, opened one at a time.
--   allocation  (new)      every trait opens at once. Each participant
--                          splits their wallet across the traits and may
--                          change the split until the facilitator closes
--                          it. On close, the highest allocation on each
--                          trait wins it (ties: earliest to reach that
--                          amount) and every allocation is charged.
--
-- Allocation mode reuses the existing tables: one auction_rounds row per
-- trait (mode = 'allocation') and one bids row per participant per trait.
-- That keeps winners, the ledger, the profile and the analytics on the
-- same data model.
--
-- The mode can only change while the event has no rounds, so an event's
-- rounds are always all of one mode. A reset (which deletes rounds)
-- unlocks it again.
--
-- Deploy this migration together with the matching application code.

-- 1. Mode columns ---------------------------------------------------------

ALTER TABLE events ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'auction';
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_game_mode_check;
ALTER TABLE events ADD CONSTRAINT events_game_mode_check
  CHECK (game_mode IN ('auction', 'allocation'));

ALTER TABLE auction_rounds ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'auction';
ALTER TABLE auction_rounds DROP CONSTRAINT IF EXISTS auction_rounds_mode_check;
ALTER TABLE auction_rounds ADD CONSTRAINT auction_rounds_mode_check
  CHECK (mode IN ('auction', 'allocation'));

-- 2. Open-round uniqueness ------------------------------------------------
--    The one-open-round rule from 005 applies to auction mode only; an
--    allocation keeps one open round per trait.

DROP INDEX IF EXISTS uq_one_open_round_per_event;
CREATE UNIQUE INDEX uq_one_open_round_per_event
  ON auction_rounds(event_id)
  WHERE status = 'open' AND mode = 'auction';

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_open_allocation_round_per_trait
  ON auction_rounds(trait_id)
  WHERE status = 'open' AND mode = 'allocation';

-- Lock ordering used by every function below, to rule out deadlocks:
--   events row  ->  auction_rounds rows (ORDER BY id)  ->  participants row(s)
-- Event rows are locked FOR NO KEY UPDATE so participant registration
-- (whose FK check takes FOR KEY SHARE on the event) is never blocked.

-- 3. Mode switch ----------------------------------------------------------
--    Error codes: invalid_mode, event_not_found, game_in_progress

CREATE OR REPLACE FUNCTION set_game_mode(p_event_id uuid, p_mode text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('auction', 'allocation') THEN
    RAISE EXCEPTION 'invalid_mode';
  END IF;

  PERFORM 1 FROM events e WHERE e.id = p_event_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  IF EXISTS (SELECT 1 FROM auction_rounds r WHERE r.event_id = p_event_id) THEN
    RAISE EXCEPTION 'game_in_progress';
  END IF;

  UPDATE events SET game_mode = p_mode WHERE id = p_event_id;
  RETURN p_mode;
END;
$$;

-- 4. Auction-mode functions now refuse to run on allocation events --------

CREATE OR REPLACE FUNCTION open_auction_round(
  p_event_id uuid,
  p_trait_id uuid
)
RETURNS TABLE (round_id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_round_id uuid;
  v_mode     text;
BEGIN
  -- Lock the event so a concurrent mode switch waits for this open (and
  -- then sees the new round), and read the mode under that lock.
  SELECT e.game_mode INTO v_mode
  FROM   events e
  WHERE  e.id = p_event_id
  FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trait_unavailable';
  END IF;
  IF v_mode <> 'auction' THEN
    RAISE EXCEPTION 'wrong_mode';
  END IF;

  -- Lock trait row. If is_used = true, abort immediately.
  PERFORM 1
  FROM   traits
  WHERE  id = p_trait_id
    AND  event_id = p_event_id
    AND  NOT is_used
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trait_unavailable';
  END IF;

  UPDATE traits SET is_used = true WHERE id = p_trait_id;

  -- The partial UNIQUE INDEX uq_one_open_round_per_event rejects a second
  -- open auction round for the event.
  INSERT INTO auction_rounds (event_id, trait_id, status, opened_at, mode)
  VALUES (p_event_id, p_trait_id, 'open', now(), 'auction')
  RETURNING id INTO v_round_id;

  UPDATE events SET current_round_id = v_round_id WHERE id = p_event_id;

  RETURN QUERY SELECT v_round_id;
END;
$$;

CREATE OR REPLACE FUNCTION close_auction_round(p_round_id uuid)
RETURNS TABLE (
  winner_id        uuid,
  winning_amount   integer,
  bidder_count     bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id       uuid;
  v_trait_id       uuid;
  v_winner_id      uuid;
  v_winning_amount integer;
  v_bidder_count   bigint;
BEGIN
  -- Allocation rounds are closed together by close_allocation, never one
  -- at a time here.
  SELECT event_id, trait_id
  INTO   v_event_id, v_trait_id
  FROM   auction_rounds
  WHERE  id = p_round_id
    AND  status = 'open'
    AND  mode = 'auction'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'round_not_open';
  END IF;

  UPDATE auction_rounds
  SET    status    = 'closed',
         closed_at = now()
  WHERE  id = p_round_id;

  SELECT COUNT(*) INTO v_bidder_count
  FROM   bids
  WHERE  round_id = p_round_id;

  SELECT participant_id, amount
  INTO   v_winner_id, v_winning_amount
  FROM   bids
  WHERE  round_id = p_round_id
  ORDER  BY amount DESC, updated_at ASC
  LIMIT  1;

  IF v_winner_id IS NOT NULL THEN
    UPDATE participants
    SET    wallet_balance = GREATEST(0, wallet_balance - v_winning_amount)
    WHERE  id = v_winner_id;

    INSERT INTO wallet_transactions
      (event_id, participant_id, round_id, amount_delta, reason)
    VALUES
      (v_event_id, v_winner_id, p_round_id, -v_winning_amount, 'round_bid_payment');

    UPDATE auction_rounds
    SET    winner_participant_id = v_winner_id,
           winning_bid_amount    = v_winning_amount
    WHERE  id = p_round_id;
  END IF;

  UPDATE traits SET is_used = true WHERE id = v_trait_id;

  RETURN QUERY SELECT v_winner_id, v_winning_amount, v_bidder_count;
END;
$$;

-- submit_bid: same as 007, plus a mode check so /api/bid/submit cannot be
-- used to bypass the allocation budget check. New error code: wrong_mode.
CREATE OR REPLACE FUNCTION submit_bid(
  p_session_token text,
  p_round_id      uuid,
  p_amount        integer
)
RETURNS TABLE (bid_amount integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_participant_id uuid;
  v_event_id       uuid;
  v_balance        integer;
  v_round_event_id uuid;
  v_round_status   text;
  v_round_mode     text;
  v_existing       integer;
BEGIN
  SELECT p.id, p.event_id, p.wallet_balance
  INTO   v_participant_id, v_event_id, v_balance
  FROM   participant_sessions s
  JOIN   participants p ON p.id = s.participant_id
  WHERE  s.session_token = p_session_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;

  SELECT r.event_id, r.status, r.mode
  INTO   v_round_event_id, v_round_status, v_round_mode
  FROM   auction_rounds r
  WHERE  r.id = p_round_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'round_not_found';
  END IF;
  IF v_round_event_id <> v_event_id THEN
    RAISE EXCEPTION 'event_mismatch';
  END IF;
  IF v_round_mode <> 'auction' THEN
    RAISE EXCEPTION 'wrong_mode';
  END IF;
  IF v_round_status <> 'open' THEN
    RAISE EXCEPTION 'round_not_open';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  SELECT b.amount INTO v_existing
  FROM   bids b
  WHERE  b.round_id = p_round_id
    AND  b.participant_id = v_participant_id
  FOR UPDATE;

  IF v_existing IS NOT NULL AND p_amount <= v_existing THEN
    RAISE EXCEPTION 'bid_not_higher';
  END IF;

  INSERT INTO bids AS b (round_id, participant_id, amount, created_at, updated_at)
  VALUES (p_round_id, v_participant_id, p_amount, now(), now())
  ON CONFLICT (round_id, participant_id) DO UPDATE
    SET amount     = EXCLUDED.amount,
        updated_at = now()
    WHERE b.amount < EXCLUDED.amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bid_not_higher';
  END IF;

  RETURN QUERY SELECT p_amount;
END;
$$;

-- 5. Open the allocation --------------------------------------------------
--    Opens one allocation round for every unused trait of the event.
--    Error codes: event_not_found, wrong_mode, allocation_already_open,
--    no_traits

CREATE OR REPLACE FUNCTION open_allocation(p_event_id uuid)
RETURNS TABLE (round_count integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_mode  text;
  v_count integer;
BEGIN
  SELECT e.game_mode INTO v_mode
  FROM   events e
  WHERE  e.id = p_event_id
  FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;
  IF v_mode <> 'allocation' THEN
    RAISE EXCEPTION 'wrong_mode';
  END IF;

  IF EXISTS (
    SELECT 1 FROM auction_rounds r
    WHERE  r.event_id = p_event_id AND r.status = 'open'
  ) THEN
    RAISE EXCEPTION 'allocation_already_open';
  END IF;

  PERFORM 1
  FROM   traits t
  WHERE  t.event_id = p_event_id AND NOT t.is_used
  ORDER  BY t.id
  FOR UPDATE;

  INSERT INTO auction_rounds (event_id, trait_id, status, opened_at, mode)
  SELECT p_event_id, t.id, 'open', now(), 'allocation'
  FROM   traits t
  WHERE  t.event_id = p_event_id AND NOT t.is_used;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'no_traits';
  END IF;

  UPDATE traits
  SET    is_used = true
  WHERE  event_id = p_event_id AND NOT is_used;

  RETURN QUERY SELECT v_count;
END;
$$;

-- 6. Save a participant's allocation --------------------------------------
--    p_allocations is a JSON object { "<round_id>": <amount>, ... } and
--    replaces the participant's whole allocation: open rounds missing from
--    it, or set to 0, are cleared. The sum may not exceed the wallet.
--    updated_at only moves when an amount changes, so the tie-break stays
--    "first to reach that amount".
--    Error codes: invalid_session, allocation_not_open, round_not_open,
--    invalid_amount, insufficient_balance

CREATE OR REPLACE FUNCTION submit_allocation(
  p_session_token text,
  p_allocations   jsonb
)
RETURNS TABLE (total_allocated integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_participant_id uuid;
  v_event_id       uuid;
  v_balance        integer;
  v_open_ids       uuid[] := '{}';
  v_round_ids      uuid[] := '{}';
  v_amounts        integer[] := '{}';
  v_total          bigint := 0;
  v_id             uuid;
  v_key            text;
  v_value          jsonb;
  v_num            numeric;
BEGIN
  SELECT p.id, p.event_id
  INTO   v_participant_id, v_event_id
  FROM   participant_sessions s
  JOIN   participants p ON p.id = s.participant_id
  WHERE  s.session_token = p_session_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;

  -- Share-lock the open allocation rounds in id order. close_allocation
  -- takes FOR UPDATE on the same rows in the same order, so a save either
  -- completes before the close or sees the rounds closed.
  FOR v_id IN
    SELECT r.id
    FROM   auction_rounds r
    WHERE  r.event_id = v_event_id
      AND  r.mode = 'allocation'
      AND  r.status = 'open'
    ORDER  BY r.id
    FOR SHARE
  LOOP
    v_open_ids := v_open_ids || v_id;
  END LOOP;

  IF cardinality(v_open_ids) = 0 THEN
    RAISE EXCEPTION 'allocation_not_open';
  END IF;

  IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'object' THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  -- Serialise saves from the same participant (double taps, two tabs).
  SELECT p.wallet_balance INTO v_balance
  FROM   participants p
  WHERE  p.id = v_participant_id
  FOR NO KEY UPDATE;

  FOR v_key, v_value IN SELECT e.key, e.value FROM jsonb_each(p_allocations) e
  LOOP
    IF v_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'round_not_open';
    END IF;
    v_id := v_key::uuid;
    IF NOT (v_id = ANY (v_open_ids)) THEN
      RAISE EXCEPTION 'round_not_open';
    END IF;
    IF v_id = ANY (v_round_ids) THEN
      RAISE EXCEPTION 'invalid_amount';
    END IF;

    IF jsonb_typeof(v_value) <> 'number' THEN
      RAISE EXCEPTION 'invalid_amount';
    END IF;
    v_num := v_value::numeric;
    IF v_num < 0 OR v_num <> trunc(v_num) OR v_num > 2147483647 THEN
      RAISE EXCEPTION 'invalid_amount';
    END IF;

    v_round_ids := v_round_ids || v_id;
    v_amounts   := v_amounts || v_num::integer;
    v_total     := v_total + v_num::integer;
  END LOOP;

  IF v_total > v_balance THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  DELETE FROM bids b
  WHERE  b.participant_id = v_participant_id
    AND  b.round_id = ANY (v_open_ids)
    AND  NOT EXISTS (
      SELECT 1
      FROM   unnest(v_round_ids, v_amounts) AS w(round_id, amount)
      WHERE  w.round_id = b.round_id AND w.amount > 0
    );

  INSERT INTO bids AS b (round_id, participant_id, amount, created_at, updated_at)
  SELECT w.round_id, v_participant_id, w.amount, now(), now()
  FROM   unnest(v_round_ids, v_amounts) AS w(round_id, amount)
  WHERE  w.amount > 0
  ON CONFLICT (round_id, participant_id) DO UPDATE
    SET amount     = EXCLUDED.amount,
        updated_at = now()
    WHERE b.amount IS DISTINCT FROM EXCLUDED.amount;

  RETURN QUERY SELECT v_total::integer;
END;
$$;

-- 7. Close the allocation -------------------------------------------------
--    Atomic and idempotent: a second call finds no open rounds and raises
--    allocation_not_open. Picks the winner of every trait, charges every
--    allocation (one ledger row each) and deducts each wallet once.
--    Error codes: event_not_found, allocation_not_open

CREATE OR REPLACE FUNCTION close_allocation(p_event_id uuid)
RETURNS TABLE (
  rounds_closed        integer,
  participants_charged integer,
  total_charged        bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_round_ids    uuid[] := '{}';
  v_id           uuid;
  v_participants integer;
  v_total        bigint;
BEGIN
  PERFORM 1 FROM events e WHERE e.id = p_event_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  -- Waits for in-flight saves (FOR SHARE) to finish.
  FOR v_id IN
    SELECT r.id
    FROM   auction_rounds r
    WHERE  r.event_id = p_event_id
      AND  r.mode = 'allocation'
      AND  r.status = 'open'
    ORDER  BY r.id
    FOR UPDATE
  LOOP
    v_round_ids := v_round_ids || v_id;
  END LOOP;

  IF cardinality(v_round_ids) = 0 THEN
    RAISE EXCEPTION 'allocation_not_open';
  END IF;

  UPDATE auction_rounds
  SET    status    = 'closed',
         closed_at = now()
  WHERE  id = ANY (v_round_ids);

  -- Winner per trait: highest allocation, earliest updated_at on a tie.
  UPDATE auction_rounds r
  SET    winner_participant_id = w.participant_id,
         winning_bid_amount    = w.amount
  FROM (
    SELECT DISTINCT ON (b.round_id) b.round_id, b.participant_id, b.amount
    FROM   bids b
    WHERE  b.round_id = ANY (v_round_ids)
    ORDER  BY b.round_id, b.amount DESC, b.updated_at ASC, b.created_at ASC
  ) w
  WHERE  r.id = w.round_id;

  INSERT INTO wallet_transactions
    (event_id, participant_id, round_id, amount_delta, reason)
  SELECT p_event_id, b.participant_id, b.round_id, -b.amount, 'round_bid_payment'
  FROM   bids b
  WHERE  b.round_id = ANY (v_round_ids);

  UPDATE participants p
  SET    wallet_balance = GREATEST(0, p.wallet_balance - t.total)
  FROM (
    SELECT b.participant_id, SUM(b.amount) AS total
    FROM   bids b
    WHERE  b.round_id = ANY (v_round_ids)
    GROUP  BY b.participant_id
  ) t
  WHERE  p.id = t.participant_id;

  GET DIAGNOSTICS v_participants = ROW_COUNT;

  SELECT COALESCE(SUM(b.amount), 0) INTO v_total
  FROM   bids b
  WHERE  b.round_id = ANY (v_round_ids);

  RETURN QUERY SELECT cardinality(v_round_ids), v_participants, v_total;
END;
$$;

-- 8. Privileges -----------------------------------------------------------
--    The new functions are server-only, like submit_bid in 007.

REVOKE EXECUTE ON FUNCTION set_game_mode(uuid, text)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION open_allocation(uuid)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION submit_allocation(text, jsonb)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION close_allocation(uuid)            FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION set_game_mode(uuid, text)         TO service_role;
GRANT  EXECUTE ON FUNCTION open_allocation(uuid)             TO service_role;
GRANT  EXECUTE ON FUNCTION submit_allocation(text, jsonb)    TO service_role;
GRANT  EXECUTE ON FUNCTION close_allocation(uuid)            TO service_role;
