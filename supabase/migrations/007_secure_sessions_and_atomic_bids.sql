-- ============================================================
-- 007 Secure participant sessions + atomic bid submission
-- ============================================================
-- Two fixes ahead of the live workshop:
--
--   1. Session tokens were stored on `participants`, which anon clients
--      can read (and receive over Realtime). Anyone holding the public
--      anon key could list every token and bid on another participant's
--      behalf. Tokens move to `participant_sessions`, which has RLS on
--      and no policies, so only the service role can read it.
--      The permissive anon INSERT policy on `participants` is dropped as
--      well: registration already goes through the service role, and the
--      policy let a browser create a participant with any wallet balance.
--
--   2. Bid submission was a read-then-write in the route handler. A bid
--      could land after the round closed, two concurrent raises could
--      leave the lower amount stored, and a double tap on the first bid
--      hit the unique constraint and returned a 500. `submit_bid` does
--      the whole thing in one transaction, holding a share lock on the
--      round row so it serialises against close_auction_round's
--      FOR UPDATE lock.
--
-- Deploy this migration together with the matching application code:
-- the new code reads tokens from `participant_sessions` and calls
-- `submit_bid`.

-- 1. Session tokens ------------------------------------------------------

CREATE TABLE IF NOT EXISTS participant_sessions (
  participant_id uuid PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
  session_token  text NOT NULL UNIQUE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE participant_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON participant_sessions FROM anon, authenticated;

-- Carry over existing sessions so already-joined phones keep working,
-- then drop the exposed column. Guarded so a re-run is a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'participants'
      AND  column_name  = 'session_token'
  ) THEN
    INSERT INTO participant_sessions (participant_id, session_token)
    SELECT id, session_token
    FROM   participants
    WHERE  session_token IS NOT NULL
    ON CONFLICT (participant_id) DO NOTHING;

    ALTER TABLE participants DROP COLUMN session_token;
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Allow participant insert" ON participants;

-- 2. Atomic bid submission -----------------------------------------------
--    Error codes raised (mapped to HTTP responses in the route handler):
--      invalid_session, round_not_found, event_mismatch, round_not_open,
--      invalid_amount, insufficient_balance, bid_not_higher

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

  -- Share lock: many bids can proceed in parallel, but close_auction_round
  -- (FOR UPDATE) waits for in-flight bids and any bid arriving after the
  -- close re-reads the row and sees status = 'closed'.
  SELECT r.event_id, r.status
  INTO   v_round_event_id, v_round_status
  FROM   auction_rounds r
  WHERE  r.id = p_round_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'round_not_found';
  END IF;
  IF v_round_event_id <> v_event_id THEN
    RAISE EXCEPTION 'event_mismatch';
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

  -- Lock this participant's existing bid (if any) so concurrent raises
  -- from the same participant are applied in order.
  SELECT b.amount INTO v_existing
  FROM   bids b
  WHERE  b.round_id = p_round_id
    AND  b.participant_id = v_participant_id
  FOR UPDATE;

  IF v_existing IS NOT NULL AND p_amount <= v_existing THEN
    RAISE EXCEPTION 'bid_not_higher';
  END IF;

  -- ON CONFLICT covers two first bids racing each other; the WHERE guard
  -- makes sure a lower amount can never overwrite a higher one.
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

-- Only the server (service role) may call this; the browser goes through
-- /api/bid/submit.
REVOKE EXECUTE ON FUNCTION submit_bid(text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION submit_bid(text, uuid, integer) TO service_role;
