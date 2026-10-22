-- ============================================================
-- 012 Round stats in one call (participant phones)
-- ============================================================
-- While a round is open every phone shows the group picture: how many
-- have bid, how many have not, how many are out of coins, the highest
-- bid and whether this participant leads. Until now each phone computed
-- that itself from two queries, one of which downloaded every
-- participant of the room (~100 rows) on every bid in the room.
--
-- get_round_stats returns the six numbers in one request and sends no
-- participant list. It is read-only, runs with the caller's privileges
-- (the public-read policies apply) and is callable from the browser.

-- Shared NGG Supabase project: this app lives in the `auction` schema (see 000).
set search_path to auction;

CREATE OR REPLACE FUNCTION get_round_stats(
  p_room_id        uuid,
  p_round_id       uuid,
  p_participant_id uuid
)
RETURNS TABLE (
  bidder_count          integer,
  no_bid_count          integer,
  folded_count          integer,
  highest_bid           integer,
  leader_participant_id uuid,
  my_amount             integer
)
LANGUAGE sql
STABLE
SET search_path = auction
AS $$
  WITH b AS (
    SELECT participant_id, amount, updated_at
    FROM   bids
    WHERE  round_id = p_round_id AND room_id = p_room_id
  ),
  top AS (
    -- Same order as the server's tie-break: highest amount, then first to reach it.
    SELECT participant_id, amount FROM b ORDER BY amount DESC, updated_at ASC LIMIT 1
  ),
  p AS (
    SELECT id, wallet_balance FROM participants WHERE room_id = p_room_id
  )
  SELECT
    (SELECT count(*) FROM b)::integer,
    (SELECT count(*) FROM p WHERE p.wallet_balance > 0 AND NOT EXISTS (SELECT 1 FROM b WHERE b.participant_id = p.id))::integer,
    (SELECT count(*) FROM p WHERE p.wallet_balance = 0 AND NOT EXISTS (SELECT 1 FROM b WHERE b.participant_id = p.id))::integer,
    COALESCE((SELECT amount FROM top), 0),
    (SELECT participant_id FROM top),
    COALESCE((SELECT amount FROM b WHERE b.participant_id = p_participant_id), 0);
$$;

GRANT EXECUTE ON FUNCTION get_round_stats(uuid, uuid, uuid) TO anon, authenticated, service_role;

-- Supports the per-participant lookups above and the phone's "my bid" read.
CREATE INDEX IF NOT EXISTS idx_bids_participant_round ON bids(participant_id, round_id);
CREATE INDEX IF NOT EXISTS idx_participants_room_wallet ON participants(room_id, wallet_balance);
