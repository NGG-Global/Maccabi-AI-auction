# NGG Auction Rooms

Live, real-time auction game for leadership workshops. Participants join from
their phones (Hebrew, RTL), bid coins on leadership statements, and the
facilitator runs the game from a laptop whose screen is projected to the room.

The app is a **multi-room platform**: NGG staff sign in, create auction
rooms with their own settings (statements, game mode, starting coins, client
logo), and run each room as a separate live event with its own projected
screen and join QR code.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- Supabase Postgres + Realtime, in the `auction` schema of the shared NGG project
- Supabase Storage (bucket `auction-logos`) for client logos
- Vercel

## Concepts

| Term | Meaning |
|---|---|
| Room | One auction event: title, client, logo, game mode, starting coins, statements. Table `auction.rooms`. |
| Statement (trait) | A leadership statement that is auctioned. Each has one of four fixed categories (מנהיגות, יחסים, שיפוט, למידה); the participant profile archetype depends on them. |
| Live window | Pressing **הפעל** on a room opens a 12-hour window in which participants can join and bid. It can be extended or ended from the live screen. |
| Locked settings | While a room has participants or rounds, its game mode, coins, round length, slug and statements cannot change. A reset clears the play data and unlocks them. |

### Game modes

- **auction**: one statement per round. Participants bid and raise while the
  round is open; on close only the winner pays. Ties go to whoever reached the
  amount first.
- **allocation**: every statement opens at once; each participant splits their
  wallet across them. On close every allocation is charged; the top amount on
  each statement wins, and a tie is a shared win.

All game logic is server-authoritative: Postgres functions (`submit_bid`,
`close_auction_round`, `open_allocation`, `submit_allocation`,
`close_allocation`, `register_participant`, `reset_room`, …) run atomically and
verify that every row they touch belongs to the room they were called for.
Composite foreign keys (`(participant_id, room_id)`, `(round_id, room_id)`)
make cross-room data impossible at the database level, whatever the
application does.

## URLs

| Path | Who | What |
|---|---|---|
| `/admin/login` | NGG staff | E-mail on `@nggconsult.com` + shared staff password |
| `/admin` | staff | All rooms (every staff member sees every room) |
| `/admin/rooms/new`, `/admin/rooms/[id]` | staff | Create / edit a room: settings, statements, logo, activation |
| `/admin/rooms/[id]/live` | facilitator laptop | The projected screen: controls, live bids, winner reveal, analytics, join QR |
| `/join?room=<slug>` | participants | Join (from the QR). `?event=<slug>` from older QR codes still works |
| `/play?room=<slug>` | participants | The game |
| `/profile?room=<slug>` | participants | Personal summary and archetype |

## Setup

### 1. Environment variables

Copy `.env.example` to `.env.local` (and set the same values on Vercel):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser reads + Realtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side writes (never sent to the browser) |
| `NGG_STAFF_PASSWORD` | Shared staff password for `/admin` |
| `NGG_SESSION_SECRET` | Signs the staff cookie; at least 16 random characters |

### 2. Database

Run the migrations in order in the Supabase SQL editor (each as one
transaction), then `supabase/seed.sql`. Migration headers describe what
they do; `010_rooms.sql` is the multi-room migration and its header
includes a read-only pre-check query to run first.

The schema `auction` must be listed under *Project Settings → Data API →
Exposed schemas*.

### 3. Logo bucket

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run create-logo-bucket
```

Creates the public bucket `auction-logos` (2MB, PNG/JPG/WEBP). Uploads go
through the server only, after a check of the file's actual bytes.

### 4. Run

```bash
npm install
npm run dev
```

## Development checks

```bash
npm run typecheck      # tsc
npm run lint           # eslint
npm test               # unit tests (auth, logo checks, analytics, validation)
npm run test:integration   # room isolation against a local Postgres (see below)
```

### Integration tests on a local Postgres

The integration suite needs a real Postgres with the schema applied. **Never
point it at the shared NGG project.** With a local Postgres 16:

```bash
createdb auction_test
DATABASE_URL=postgres://postgres@127.0.0.1:5432/auction_test scripts/test-db/migrate.sh
DATABASE_URL=postgres://postgres@127.0.0.1:5432/auction_test npm run test:integration
```

`scripts/test-db/migrate.sh` creates the Supabase API roles and the Realtime
publication the migrations expect, applies `000` → `011` and the seed.

## Security notes

- The staff area (`/admin/*`, `/api/admin/*`) is gated twice: `proxy.ts`
  redirects or returns 401 without a valid cookie, and every page and route
  handler verifies the session again.
- The staff cookie is a signed (HMAC-SHA256) `httpOnly`, `Secure`,
  `SameSite=Lax` cookie valid for 30 days; the login compares the password in
  constant time and failed attempts are rate-limited per IP (10 per 15
  minutes, stored in `auction.staff_login_attempts`).
- One shared password means the e-mail recorded as a room's creator is
  self-declared. Moving to Microsoft SSO is the recommended next step.
- Participant session tokens stay in `auction.participant_sessions`, which the
  browser cannot read. The browser can read only a fixed list of room columns
  (no staff e-mails, no live-window timestamps).

## Pre-event manual checklist

Run through this on the real deployment, with a phone and the laptop that
will be projected, before every workshop. See `docs/PRE-EVENT-CHECKLIST.md`
for the full Hebrew checklist.
