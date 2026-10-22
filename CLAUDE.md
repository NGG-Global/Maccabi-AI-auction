# Claude Code Instructions

## Project identity

Live real-time auction game for in-person leadership workshops (~100 participants per room).

A multi-room platform (migration 010): NGG staff sign in at `/admin`, create **rooms** (`auction.rooms`: title, client, logo, game mode, starting coins, statements) and run each room as a separate live event with its own projected screen at `/admin/rooms/[id]/live` and its own join QR (`/join?room=<slug>`).

Two interfaces:
1. Participant — mobile phone, Hebrew RTL
2. Facilitator/Admin — laptop dashboard, which is also the display projected to the room (includes the join QR code)

Core rule: Every participant starts with the room's `starting_coins`. Each round auctions one leadership statement (trait). Participants bid or raise while open. When the facilitator closes a round, only the winner pays their bid; everyone else keeps their coins. Highest bid wins; a tie goes to whoever reached that amount first (earliest `updated_at`).

Rooms: a room is **live** while `status = 'active'` and `active_until > now()` (12 hours from the last activation; `set_room_status`). Participants can join and bid only while live. Game-shaping settings (mode, coins, round length, slug, statements) are **locked** while the room has participants or rounds; `reset_room` unlocks them. Rooms that hosted a game are archived, never deleted.

Staff auth: `@nggconsult.com` e-mail + `NGG_STAFF_PASSWORD`, signed cookie (`lib/auth`), gated by `proxy.ts` and again in every handler. Rate-limited per IP via `auction.staff_login_attempts`.

## Game modes

The facilitator picks the mode in the room form before the game starts (`rooms.game_mode`). It is locked while the room has play data; a reset unlocks it.

- `auction` — the rule above: one trait per round, opened one at a time.
- `allocation` — every trait opens at once (one `auction_rounds` row per trait, `mode = 'allocation'`). Each participant splits their wallet across the traits; a save replaces their whole split and the total may not exceed the wallet. They can change it until the facilitator closes. `close_allocation` closes all traits atomically and charges every allocation, won or not. The highest allocation per trait wins; a tie on the top amount is a shared win — every participant on that amount is a winner (`round_winners`, migration 009; `winner_participant_id` is set only when the win is not shared). Participants see only their own split; the projected dashboard shows participation while open and the per-trait results after close.

DB functions (migrations 008–010): `open_allocation`, `submit_allocation`, `close_allocation`. Auction functions refuse allocation rooms and vice versa. Every game function takes `p_room_id` and verifies every row belongs to that room; `bids` and `round_winners` carry `room_id` with composite foreign keys so cross-room rows are impossible.

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
- Every RPC call and every query is scoped by `room_id`; Realtime subscriptions filter on `room_id`.
- PostgREST embeds must use the FK hints in `lib/supabase/embeds.ts` (child tables have two FKs to the same parent since 010).
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
  join/                    # /join?room=slug
  play/                    # participant experience (/play?room=slug)
  profile/                 # end-of-game profile (/profile?room=slug)
  admin/login/             # staff login
  admin/(staff)/           # rooms list, room form (header + session check)
  admin/(live)/rooms/[id]/live/   # the projected screen of one room
  api/admin/               # staff-only route handlers (rooms CRUD, status, logo, game controls)
  api/participant|bid|allocation/ # participant route handlers
components/
  admin/                   # RoomForm, RoomsList, TraitsEditor, LogoUploader, StaffHeader
  admin/live/              # AuctionDashboard, AllocationDashboard, AnalyticsDashboard
  shared/                  # RoomBrand
lib/
  auth/                    # staff-core (web crypto, pure), staff (cookies), rate-limit
  rooms/                   # service (server reads), validate, slug
  storage/logo.ts          # logo checks + URLs
  supabase/                # browser/server clients, schema, embeds (FK hints)
  game/                    # winner selection, allocation, analytics (pure functions)
  hooks/                   # realtime analytics, round timer
  participant-session.ts   # per-room localStorage on the phone
  types.ts                 # shared DB types
proxy.ts                   # gate for /admin and /api/admin
supabase/migrations/       # numbered SQL migration files (010 = rooms)
supabase/seed.sql
scripts/create-logo-bucket.mjs
scripts/test-db/           # local Postgres bootstrap for the integration tests
tests/unit, tests/integration
docs/PRE-EVENT-CHECKLIST.md
```

## Definition of done

- Staff can sign in, create a room, activate it and open its live screen.
- Two rooms can run at the same time without affecting each other (tests/integration).
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
