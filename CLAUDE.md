# Claude Code Instructions

## Project identity

Live real-time auction game for an in-person leadership workshop (~100 participants).

Two interfaces:
1. Participant — mobile phone, Hebrew RTL
2. Facilitator/Admin — laptop dashboard, which is also the display projected to the room (includes the join QR code)

Core rule: Every participant starts with 1,000 coins. Each round auctions one leadership trait. Participants bid or raise while open. When the facilitator closes a round, only the winner pays their bid; everyone else keeps their coins. Highest bid wins; a tie goes to whoever reached that amount first (earliest `updated_at`).

## Game modes

The facilitator picks the mode on the admin dashboard before the game starts (`events.game_mode`). It is locked while the event has any round; a reset unlocks it.

- `auction` — the rule above: one trait per round, opened one at a time.
- `allocation` — every trait opens at once (one `auction_rounds` row per trait, `mode = 'allocation'`). Each participant splits their wallet across the traits; a save replaces their whole split and the total may not exceed the wallet. They can change it until the facilitator closes. `close_allocation` closes all traits atomically and charges every allocation, won or not. The highest allocation per trait wins; a tie on the top amount is a shared win — every participant on that amount is a winner (`round_winners`, migration 009; `winner_participant_id` is set only when the win is not shared). Participants see only their own split; the projected dashboard shows participation while open and the per-trait results after close.

DB functions (migrations 008–009): `set_game_mode`, `open_allocation`, `submit_allocation`, `close_allocation`. Auction functions refuse allocation events and vice versa.

## Top priorities

1. Reliability during a live event.
2. Server-authoritative game logic.
3. Clean mobile-first Hebrew RTL UX.
4. Clear facilitator controls.
5. Real-time updates via Supabase Realtime.
6. Easy reset / rehearsal tools.

## Critical rules

- Never deduct wallets on the client.
- Never determine winners on the client.
- Never expose `service_role` key to the browser.
- Participants must never update `wallet_balance` directly.
- All sensitive mutations verify authorization server-side.
- Round close is atomic and idempotent — use `SELECT FOR UPDATE` / status guard.
- Realtime is for UI responsiveness only; DB is the source of truth.

## Stack

- Next.js 16 App Router (see AGENTS.md — read node_modules/next/dist/docs before coding)
- TypeScript
- Tailwind CSS v4
- Supabase Postgres + Realtime — the shared NGG Supabase project, schema `auction` (see below)
- Vercel

## Database schema

The NGG apps share one Supabase project, each in its own Postgres schema; this app's is `auction` (`supabase/migrations/000_app_schema.sql`).

- Every Supabase client passes `db: { schema: DB_SCHEMA }` (`lib/supabase/schema.ts`), and every Realtime `postgres_changes` subscription uses `schema: DB_SCHEMA`.
- A new migration starts with `set search_path to auction;`, and every function it creates carries `SET search_path = auction`.
- Never create objects in `public`, and never add triggers to `auth.users` — that table is shared by all the apps.

## UI language

- End-user UI: Hebrew, RTL (`dir="rtl"`)
- Code, variables, DB, internal docs: English

## Repo structure

```
app/
  join/          # /join?event=slug
  play/          # participant experience
  admin/         # facilitator dashboard
  profile/       # end-of-game profile
  api/           # route handlers
components/
  participant/
  admin/
  shared/
lib/
  supabase/      # client + server + middleware helpers
  game/          # winner selection, bid validation (pure functions)
  auth/          # admin session helpers
  types.ts       # shared DB types
supabase/
  migrations/    # numbered SQL migration files
  seed.sql
  policies.sql
scripts/
  seed-demo.ts
  simulate-bids.ts
  reset-event.ts
```

## Definition of done

- Participant can join via QR.
- Facilitator can open a round.
- Participant can bid and raise.
- Facilitator can close a round.
- Winner is calculated correctly server-side.
- Charges are applied server-side (auction: the winner; allocation: every allocation).
- Balances update correctly.
- Admin dashboard (the projected display) updates in real time.
- Participant profile shows meaningful summary.
- Reset/test mode exists.
