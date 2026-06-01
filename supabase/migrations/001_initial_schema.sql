-- ============================================================
-- 001 Initial Schema — Maccabi AI Auction Game
-- ============================================================

-- Events
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'ended')),
  current_round_id uuid null,
  created_at timestamptz not null default now()
);

-- Participants
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  display_name text not null,
  wallet_balance integer not null default 1000
    check (wallet_balance >= 0),
  session_token text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz null
);

-- Traits
create table if not exists traits (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text not null,
  description text not null,
  category text null,
  sort_order integer null,
  is_used boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auction Rounds
create table if not exists auction_rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  trait_id uuid not null references traits(id),
  status text not null default 'draft'
    check (status in ('draft', 'open', 'closed', 'cancelled')),
  opened_at timestamptz null,
  closed_at timestamptz null,
  winner_participant_id uuid null references participants(id),
  winning_bid_amount integer null,
  created_at timestamptz not null default now()
);

-- Add FK back from events to current_round
alter table events
  add constraint fk_events_current_round
  foreign key (current_round_id) references auction_rounds(id)
  deferrable initially deferred;

-- Bids (one per participant per round; upserted on raise)
create table if not exists bids (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references auction_rounds(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(round_id, participant_id)
);

-- Wallet Transactions (ledger)
create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  round_id uuid null references auction_rounds(id),
  amount_delta integer not null,
  reason text not null
    check (reason in ('initial_grant', 'round_bid_payment', 'admin_adjustment', 'reset')),
  created_at timestamptz not null default now()
);

-- Indexes
create index on participants(event_id);
create index on participants(session_token);
create index on traits(event_id);
create index on auction_rounds(event_id);
create index on bids(round_id);
create index on bids(participant_id);
create index on wallet_transactions(participant_id);
