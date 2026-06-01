-- ============================================================
-- 003 Enable Supabase Realtime for live-auction tables
-- ============================================================
-- Without this, postgres_changes subscriptions connect but receive
-- zero events. Run this migration against your Supabase project.

alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.auction_rounds;
alter publication supabase_realtime add table public.traits;
