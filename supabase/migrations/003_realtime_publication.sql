-- ============================================================
-- 003 Enable Supabase Realtime for live-auction tables
-- ============================================================
-- Without this, postgres_changes subscriptions connect but receive
-- zero events. Run this migration against your Supabase project.

-- Shared NGG Supabase project: this app lives in the `auction` schema (see 000).
set search_path to auction;

alter publication supabase_realtime add table auction.participants;
alter publication supabase_realtime add table auction.bids;
alter publication supabase_realtime add table auction.auction_rounds;
alter publication supabase_realtime add table auction.traits;
