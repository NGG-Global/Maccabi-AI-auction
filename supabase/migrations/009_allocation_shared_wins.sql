-- ============================================================
-- 009 Allocation mode: ties end in a shared win
-- ============================================================
-- In allocation mode nobody sees anyone else's split, so "first to save"
-- is luck rather than a decision. A tie on the top amount of a trait now
-- makes every participant on that amount a winner of the trait.
-- (Everyone is charged their allocation regardless, so a shared win
-- changes no balances.)
--
-- Auction mode is unchanged: only the winner pays, and a tie goes to the
-- participant who reached the amount first.
--
-- round_winners is the authoritative winner list for allocation rounds.
-- auction_rounds.winning_bid_amount holds the top amount;
-- winner_participant_id is set only when the win is not shared.
--
-- Additive on top of 008, so it applies whether or not 008 already ran.
-- Deploy together with the matching application code.

-- Shared NGG Supabase project: this app lives in the `auction` schema (see 000).
set search_path to auction;

-- 1. Winner list ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS round_winners (
  round_id       uuid NOT NULL REFERENCES auction_rounds(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  amount         integer NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_round_winners_participant ON round_winners(participant_id);

-- Written only by close_allocation (service role); readable like the other
-- game tables, for the dashboard, the phone results and the profile.
ALTER TABLE round_winners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read round winners" ON round_winners;
CREATE POLICY "Public read round winners" ON round_winners
  FOR SELECT USING (true);

-- 2. close_allocation with shared wins ---------------------------------------
--    Return type gains tied_traits, so the function is recreated.
--    Error codes unchanged: event_not_found, allocation_not_open

DROP FUNCTION IF EXISTS close_allocation(uuid);

CREATE FUNCTION close_allocation(p_event_id uuid)
RETURNS TABLE (
  rounds_closed        integer,
  participants_charged integer,
  total_charged        bigint,
  tied_traits          integer
)
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_round_ids    uuid[] := '{}';
  v_id           uuid;
  v_participants integer;
  v_total        bigint;
  v_tied         integer;
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

  -- Everyone on the top amount of a trait wins it.
  INSERT INTO round_winners (round_id, participant_id, amount)
  SELECT b.round_id, b.participant_id, b.amount
  FROM   bids b
  JOIN (
    SELECT round_id, MAX(amount) AS top
    FROM   bids
    WHERE  round_id = ANY (v_round_ids)
    GROUP  BY round_id
  ) m ON m.round_id = b.round_id AND b.amount = m.top
  ON CONFLICT (round_id, participant_id) DO NOTHING;

  UPDATE auction_rounds r
  SET    winning_bid_amount    = w.top,
         winner_participant_id = CASE WHEN w.winner_count = 1 THEN w.first_winner END
  FROM (
    SELECT round_id,
           MAX(amount)                AS top,
           COUNT(*)                   AS winner_count,
           (array_agg(participant_id))[1] AS first_winner
    FROM   round_winners
    WHERE  round_id = ANY (v_round_ids)
    GROUP  BY round_id
  ) w
  WHERE  r.id = w.round_id;

  SELECT COUNT(*) INTO v_tied
  FROM (
    SELECT round_id
    FROM   round_winners
    WHERE  round_id = ANY (v_round_ids)
    GROUP  BY round_id
    HAVING COUNT(*) > 1
  ) t;

  -- Every allocation is charged: one ledger row each, one wallet update
  -- per participant.
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

  RETURN QUERY SELECT cardinality(v_round_ids), v_participants, v_total, v_tied;
END;
$$;

REVOKE EXECUTE ON FUNCTION close_allocation(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION close_allocation(uuid) TO service_role;
