# Claude Code Instructions

## Project identity

Live real-time auction game for an in-person leadership workshop (~100 participants).

Three interfaces:
1. Participant — mobile phone, Hebrew RTL
2. Facilitator/Admin — laptop dashboard
3. Projection screen — large display, read-only

Core rule: Every participant starts with 1,000 coins. Each round auctions one leadership trait. Participants bid or raise while open. When the facilitator closes a round, every bidder pays their final bid even if they lost. Highest bid wins; ties broken by earliest `updated_at`.

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
- Supabase Postgres + Realtime
- Vercel

## UI language

- End-user UI: Hebrew, RTL (`dir="rtl"`)
- Code, variables, DB, internal docs: English

## Repo structure

```
app/
  join/          # /join?event=slug
  play/          # participant experience
  admin/         # facilitator dashboard
  screen/[slug]/ # projection screen
  profile/       # end-of-game profile
  api/           # route handlers
components/
  participant/
  admin/
  screen/
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
- All bidders are charged server-side.
- Balances update correctly.
- Projection screen updates in real time.
- Participant profile shows meaningful summary.
- Reset/test mode exists.
