-- ============================================================
-- 005 Performance & Concurrency Fixes
-- ============================================================

-- 1. Composite index for the most common query pattern:
--    "find open/closed rounds for this event"
--    Used by: open-round guard, close-round, refreshRound, analytics hook
CREATE INDEX IF NOT EXISTS idx_auction_rounds_event_status
  ON auction_rounds(event_id, status);

-- 2. Composite index for the bid leaderboard + analytics fetch
CREATE INDEX IF NOT EXISTS idx_bids_round_amount
  ON bids(round_id, amount DESC);

-- 3. Ledger lookups filtered by event (used in analytics + reset)
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_event
  ON wallet_transactions(event_id);

-- 4. Enforce at most one open round per event at the DB level.
--    This is a partial unique index — the WHERE clause means only one
--    row with status='open' can exist for each event_id at a time.
--    The open-round API's application-level guard becomes a safety net;
--    the real enforcement is here. A concurrent duplicate insert gets a
--    unique-constraint violation which the API converts to a 409.
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_open_round_per_event
  ON auction_rounds(event_id)
  WHERE status = 'open';

-- 5. Atomic close-round stored procedure.
--    Replaces the multi-step application logic in close-round/route.ts.
--    Runs in a single transaction so the wallet deduction and ledger
--    entry are always consistent, and no bid can be accepted between
--    the status flip and the balance update.
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
  -- Lock the round row and verify it is still open.
  -- FOR UPDATE prevents any concurrent call from reading a stale status.
  SELECT event_id, trait_id
  INTO   v_event_id, v_trait_id
  FROM   auction_rounds
  WHERE  id = p_round_id
    AND  status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'round_not_open';
  END IF;

  -- Mark closed immediately so no further bids are accepted.
  UPDATE auction_rounds
  SET    status    = 'closed',
         closed_at = now()
  WHERE  id = p_round_id;

  -- Count bidders.
  SELECT COUNT(*) INTO v_bidder_count
  FROM   bids
  WHERE  round_id = p_round_id;

  -- Determine winner: highest bid, earliest updated_at as tiebreak.
  SELECT participant_id, amount
  INTO   v_winner_id, v_winning_amount
  FROM   bids
  WHERE  round_id = p_round_id
  ORDER  BY amount DESC, updated_at ASC
  LIMIT  1;

  IF v_winner_id IS NOT NULL THEN
    -- Deduct from winner's wallet atomically using a delta, not a
    -- read-modify-write. GREATEST(0, ...) enforces the non-negative floor.
    UPDATE participants
    SET    wallet_balance = GREATEST(0, wallet_balance - v_winning_amount)
    WHERE  id = v_winner_id;

    -- Write ledger entry in the same transaction.
    INSERT INTO wallet_transactions
      (event_id, participant_id, round_id, amount_delta, reason)
    VALUES
      (v_event_id, v_winner_id, p_round_id, -v_winning_amount, 'round_bid_payment');

    -- Record winner on the round.
    UPDATE auction_rounds
    SET    winner_participant_id = v_winner_id,
           winning_bid_amount    = v_winning_amount
    WHERE  id = p_round_id;
  END IF;

  -- Mark the trait as used so it cannot be re-queued.
  UPDATE traits SET is_used = true WHERE id = v_trait_id;

  RETURN QUERY SELECT v_winner_id, v_winning_amount, v_bidder_count;
END;
$$;

-- 6. Atomic open-round stored procedure.
--    Atomically checks for an existing open round, marks the trait as
--    used, and inserts the new round — all in one transaction so there
--    is no window between the guard check and the insert.
CREATE OR REPLACE FUNCTION open_auction_round(
  p_event_id uuid,
  p_trait_id uuid
)
RETURNS TABLE (round_id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_round_id uuid;
BEGIN
  -- Lock trait row. If is_used = true, abort immediately.
  -- Also guards against two concurrent opens for the same trait.
  PERFORM 1
  FROM   traits
  WHERE  id = p_trait_id
    AND  event_id = p_event_id
    AND  NOT is_used
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trait_unavailable';
  END IF;

  -- Mark trait used right away (before round insert) so no second
  -- concurrent call can pass the is_used check above.
  UPDATE traits SET is_used = true WHERE id = p_trait_id;

  -- Insert new open round. The partial UNIQUE INDEX
  -- uq_one_open_round_per_event will reject this if somehow another
  -- open round was sneaked in (belt-and-suspenders).
  INSERT INTO auction_rounds (event_id, trait_id, status, opened_at)
  VALUES (p_event_id, p_trait_id, 'open', now())
  RETURNING id INTO v_round_id;

  -- Keep events.current_round_id in sync.
  UPDATE events SET current_round_id = v_round_id WHERE id = p_event_id;

  RETURN QUERY SELECT v_round_id;
END;
$$;
