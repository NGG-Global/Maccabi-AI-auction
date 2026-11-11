# "Board Game" redesign: implementation notes

Design source: `design-kit/` (DESIGN.md, COMPONENTS.md, COPY.md,
IMPLEMENTATION_PLAN.md, tokens/theme.css, reference/prototype.html). This
direction replaced the earlier dark "Evening Sale" look, which must not be used.

## What changed, by surface

**Foundation.** `app/layout.tsx` loads Fredoka (400–700, Hebrew + Latin) as
`--font-fredoka` with Heebo as `--font-heebo` fallback; `app/globals.css` carries
the tokens (`@theme`), the base rules and, inside `@layer components`, `.num`,
the dot backgrounds (`.bg-dots`, `.bg-dots-stage`, `.bg-dots-fine`), the game
piece classes (`.piece`, `.piece-press`, `.press-sm`), the roller and countdown
CSS, the `gm-*` keyframes and the reduced-motion override. Hard offset shadows
are theme tokens (`shadow-piece-xs` … `shadow-piece-2xl`); there are no blur shadows.

**Shared primitives** (`components/game/`): CoinIcon (sunflower), NumberRoller,
ParticipantMark (round tokens: ink, sky, lilac, peach, leaf, sun, pending),
WalletBar (`card` | `tint`), LotTicket (white card with tomato and sky tabs),
SoldStamp (tomato sticker), ProjectorCanvas (dot-grid stage), CountdownLine
(outlined track, tomato→sunflower fill), StatusPill, Stepper (round white
buttons), plus buttons, fields, cards, notices and the ink toast in `ui.tsx`.

**Participant phone** (`app/join`, `app/play`, `app/profile`): the mint board,
the white wallet card with the sunflower meter, the tilted lot card, the 96px
sunflower token for the highest bid, the leaf / sunflower-tint status pill, the
tomato send button with a pressed state, the sticker result, allocation rows that
turn sunflower-tint when allocated, the "sent" screen with the coin stack, and
the closed-sale result with ink-band plates and the tinted wallet bar.

**Projected screen** (`components/admin/live/`): the 1920×1080 dot-grid stage,
the tilted lot card with its tabs, the 300px sunflower price token with the
dashed inner ring, the sky leader token, the outlined ladder card with sunflower
top row, the outlined countdown, the lot queue cards with the raised sunflower
live card and tomato "נמכר" stickers, the two cues in a white outlined card, the
sunflower flash and ink ring, the tomato sticker, the lobby with the round player
tokens (sky / lilac / peach, dashed while pending) and the white QR card, the
prize board (ink band, sunflower strip and tags) and the podium (sunflower, sky,
lilac) with the white table card. The facilitator drawer and the analytics view
use the same pieces.

**Staff** (`app/admin`, `components/admin/`): login, the sessions list (ink
filter tabs, outlined rows with a hard shadow, warm fill for live rows, leaf
status pills, tomato primary action), and the session editor (outlined cards,
mode cards with a sunflower-tint selected state, the dashed rule line, the
sticky outlined action bar, and the preview on the fine dot grid).

## Changes after the first review (Nov 2026)

- **Values slide** shows every statement: places 4..N size their rows from the count, so ten statements fit at the full 49px / 36px and more shrink instead of being cut off.
- **New results slide "סך ההשקעה בכל פריט"**: one horizontal bar per statement, highest first, all on one scale, with the total at each bar's end. It is the third results tab; the arrow keys step through the slides.
- **Submission count**: the allocation phone no longer auto-saves. Nothing reaches the server, or the projected "{n} מתוך {total} שלחו", until "שליחת ההצעות". The unsent split is kept in the phone's localStorage so a refresh keeps it; a split that was never sent is not counted when the facilitator closes.
- **Phone instructions removed**: the join screen is the session name plus the name field; the waiting screens and the send footers carry no rules.
- **Numbering removed** from the winners plates (projector and phone) and from the allocation rows.
- **Phone results**: won statements first, then a visible list of statements bid on but not won.
- **One typeface**: every character the interface uses is in Fredoka, except the analytics trend arrows, which are now drawn as icons.

## Differences from the kit, with reasons

- **Step per click** is a room setting (`rooms.bid_step`, migration 013), so the
  "קפיצה בכל לחיצה" field is live; the kit still lists it under phase 6. The
  budget unit per room (`coins` | `ils`) is still pending and every room shows "מטבעות".
- **Leader name on the phone.** `get_round_stats` returns only the leader's id, so
  the phone reads that participant's display name once per new leader.
- **Bid ladder order.** Rows are ordered highest first (the server's tie-break
  order), not strictly newest first, so the top row is always the leader.
- **"מה הקבוצה מעריכה" ranking.** `lib/game/allocation.ts` ranks by total allocated,
  then fixed statement order. The kit asks for total, then number of investors,
  then fixed order. The logic was not changed.
- **Lot queue** needs the closing price of earlier lots, so the auction dashboard
  reads the room's closed rounds. **Participant wall** needs names, so both
  dashboards read the room's participants. Tokens shrink by head count.
- **Delete on the sessions list** was removed per COMPONENTS.md; the API route still exists.
- **Minimum of two statements** is enforced client-side as the kit asks.
- **Timer field** is a select; an existing non-standard value is kept as an extra option.
- The facilitator drawer is mounted only while open and carries no transform or
  backdrop filter (an RTL overflow and a trapped fixed overlay broke the stage on
  tablets in an earlier version). The QR overlay renders through a portal.

## Verification done

- `npm run build`, `npm run typecheck`, `npm run lint` (clean) and `npm test` pass.
- Game logic, Supabase clients, auth, storage, hooks, the API routes and the
  migrations are untouched by the re-theme.
- No banned copy, no emoji, no old tokens in `app/` or `components/`.
- Screens rendered with sample data through a temporary harness at 360×780
  (phone), 1920×1080 (projector) and 1440 / 390 (staff): Fredoka loads, no
  horizontal scroll, the wallet bar fits one row.
- Not verified here: the end-to-end realtime flow against Supabase. Run the
  pre-event checklist with two browsers before an event.

## Run locally

```
npm install
cp .env.example .env.local   # Supabase + NGG_STAFF_PASSWORD + NGG_SESSION_SECRET
npm run dev
```

Staff: `/admin`. Projected screen: `/admin/rooms/<id>/live` (press "מסך מלא").
Phone: scan the QR or open `/join?room=<slug>` at 360px width.
