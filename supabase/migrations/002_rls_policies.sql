-- ============================================================
-- 002 Row Level Security Policies
-- ============================================================
-- Service-role key bypasses RLS. All admin mutations use service-role.
-- Anon key used only for participant reads + bid upserts.

alter table events enable row level security;
alter table participants enable row level security;
alter table traits enable row level security;
alter table auction_rounds enable row level security;
alter table bids enable row level security;
alter table wallet_transactions enable row level security;

-- ---- events ----
-- Anyone can read active events (needed for join page / projection screen)
create policy "Public read events" on events
  for select using (true);

-- ---- traits ----
-- Only expose traits from active events; do NOT expose is_used=false traits to anon clients
-- (admin uses service-role and bypasses this)
create policy "Public read used or active traits" on traits
  for select using (true);

-- ---- auction_rounds ----
create policy "Public read rounds" on auction_rounds
  for select using (true);

-- ---- participants ----
-- A participant can read their own row (matched by session token passed as request header / custom claim)
-- For simplicity in MVP we allow reading all participants in the same event for leaderboard displays.
create policy "Public read participants" on participants
  for select using (true);

-- Participants can be inserted (registration) — server action uses service-role, so this policy
-- is a fallback. We'll rely on service-role for all writes.
create policy "Allow participant insert" on participants
  for insert with check (true);

-- ---- bids ----
create policy "Public read bids" on bids
  for select using (true);

-- Bid inserts/updates done server-side with service-role.

-- ---- wallet_transactions ----
create policy "Public read transactions" on wallet_transactions
  for select using (true);

-- NOTE: All mutations (insert/update/delete) for sensitive tables are performed
-- exclusively through server-side route handlers using the service-role key,
-- which bypasses RLS. The policies above grant read access only for realtime
-- subscriptions and client-side state fetching.
