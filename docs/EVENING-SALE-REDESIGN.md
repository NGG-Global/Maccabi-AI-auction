# "Evening Sale" redesign: implementation notes

Branch: `ccr-5b47f24a-qlij4p` (the session's designated branch; the kit asked for
`redesign/evening-sale`). Design source: `design-kit/` (DESIGN.md, COMPONENTS.md,
COPY.md, IMPLEMENTATION_PLAN.md, tokens/theme.css, reference/prototype.html).

## What changed, by surface

**Foundation.** `app/layout.tsx` loads Frank Ruhl Libre (500/700/900) and
IBM Plex Sans Hebrew (400–700) through `next/font/google` as `--font-frank` and
`--font-plex`; `app/globals.css` carries the tokens (`@theme`), the base rules,
`.num`, the stage atmosphere, the stamp mask, the roller and countdown CSS, the
keyframes and the reduced-motion override. The old gold/slate/glass classes are gone.

**Shared primitives** (`components/evening/`): CoinIcon, NumberRoller,
ParticipantMark, WalletBar, LotTicket, SoldStamp, ProjectorCanvas, CountdownLine,
StatusPill, Stepper, plus buttons/fields/cards/toast in `ui.tsx` and the
unit/step constants in `units.ts`.

**Participant phone** (`app/join`, `app/play`, `app/profile`): wallet bar on top,
lot ticket, the highest bid as a rolling number with the leader's name, a status
pill (טרם הצעתם / עקפו אותך / אתם מובילים), the stepper and the 66px send button,
the "נמכר לך / נמכר ל…" result with the stamp, the allocation list with per-lot
steppers, the "ההצעות נשלחו" screen, the closed-sale result with paper plates and
the light wallet bar, and the profile in the same language. All loading, error,
not-live and re-register states kept.

**Projected screen** (`components/admin/live/`): a 1920×1080 stage scaled to fit
(`ProjectorCanvas`), the meta row, the lot block with the 232px price, the leader
mark, the countdown line, the bid ladder (FLIP), the lot queue with the close /
next button, the two cues and the strike played only after `/api/admin/close-round`
succeeds, the lobby with the participant wall and the paper QR card, and the two
results slides ("הזוכים" prize board, "מה הקבוצה מעריכה" podium + table, version A).
The secondary facilitator controls (live window, QR/copy link, lot order
drag-and-drop, reset) live in a drawer over the stage ("בקרת המנחה", bottom-left).
The analytics view ("תמונת מצב") keeps its structure on the new tokens.

**Staff** (`app/admin`, `components/admin/`): login, header, the sessions list
(filters הכל / חיים עכשיו / טיוטות / הסתיימו / ארכיון, search, status pills, one
primary action per status, overflow menu with duplicate and archive), and the
session editor (four cards, mode cards, budget with coin, round timer select,
statements editor with move up/down + drag, inline validation with a count and
focus on the first error, sticky action bar, the locked state, and a preview fed
from the form state).

## Differences from the kit, with reasons

- **Auction step on the phone.** The schema has no per-room step. The amount is
  still free text (tap the number to type); the −/+ buttons move it by
  `AUCTION_STEP = 10` (`components/evening/units.ts`). Allocation keeps the existing 50.
- **Leader name on the phone.** `get_round_stats` returns only the leader's id, so
  the phone reads that participant's display name once per new leader (a small
  read scoped by `room_id`, cached per id).
- **Bid ladder order.** Rows are ordered highest first (the server's tie-break
  order), not strictly newest first, so the top row is always the leader.
- **"מה הקבוצה מעריכה" ranking.** `lib/game/allocation.ts` ranks by total allocated,
  then fixed statement order. The kit asks for total, then number of investors,
  then fixed order. The logic was not changed; the slide shows the code's ranking.
- **Lot queue on the projector** needs the closing price of earlier lots, so the
  auction dashboard reads the room's closed rounds (id, trait, price).
- **Participant wall** needs names, so both dashboards read the room's participants
  (id, display name). Marks shrink by head count (12 → 96px, up to 100+ → 32px).
- **Delete on the sessions list** was removed per COMPONENTS.md ("there is no
  delete action"). The API route still exists.
- **Minimum of two statements** is enforced client-side as the kit asks; the
  server still accepts one.
- **Timer field** is a select (ללא / 30 / 45 / 60 / 90 / 120 / 180 s); an existing
  non-standard value is kept as an extra option.
- **Lint.** `npm run lint` still reports 1 error and 2 warnings, all pre-existing,
  all in `lib/hooks/useAdminRealtimeAnalytics.ts` (do-not-touch). Every file in the
  redesign is clean.

## Needs a decision (phase 6, not started)

A budget unit per room (`coins` | `ils`) and a step per click require a
migration (`rooms.budget_unit`, `rooms.bid_step`), the API (`parseRoomInput`,
`create_room` / `update_room`), and the form's "יחידה" and "קפיצה בכל לחיצה"
fields. Until approved every room shows "מטבעות" and uses the steps above.

## Verification done

- `npm run build`, `npm run typecheck`, `npm test` (26 unit tests) pass.
- `git diff --stat 151e3a1 -- lib/game lib/supabase lib/auth lib/rooms lib/storage
  lib/participant-session.ts lib/hooks app/api supabase` is empty.
- No banned copy, no emoji, no `any`, no old visual classes in `app/` or `components/`.
- Screens were rendered with sample data through a temporary harness and
  screenshotted at 360×780 (phone), 1920×1080 (projector) and 1440 / 390 (staff):
  fonts load, no horizontal scroll, the wallet bar fits one row.
- Not verified here: the end-to-end realtime flow against Supabase (no backend in
  this environment). Run the pre-event checklist with two browsers before an event.

## Run locally

```
npm install
cp .env.example .env.local   # Supabase + NGG_STAFF_PASSWORD + NGG_SESSION_SECRET
npm run dev
```

Staff: `/admin`. Projected screen: `/admin/rooms/<id>/live` (press "מסך מלא").
Phone: scan the QR or open `/join?room=<slug>` at 360px width.
