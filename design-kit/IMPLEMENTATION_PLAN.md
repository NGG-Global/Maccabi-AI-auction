# Implementation plan: "Board Game" re-skin

Target repo: `NGG-Global/Maccabi-AI-auction`, last inspected at commit `151e3a1` (22 Oct 2026). If the repo has moved on, re-check the file map below before editing.

## Scope
Restyle all three surfaces, keep behavior:
1. **Participant phone:** join, auction round, budget allocation, waiting/sent, personal result/profile.
2. **Projected facilitator screen:** live auction round, open allocation, the two results slides (version A of both), live window controls.
3. **Staff session management:** login, sessions list, create/edit session, statements editor, logo upload, join share, reset.

## Do not touch (logic and data)
- `lib/game/**` (winner rules, allocation rules, analytics, validation)
- `app/api/**` (all routes)
- `lib/supabase/**`, `lib/auth/**`, `lib/rooms/**`, `lib/storage/**`, `lib/participant-session.ts`
- `lib/hooks/**` (realtime and timers). You may read their return values. Do not change what they do.
- `supabase/**` (migrations, seed)

You may add new presentational files (components, CSS) and change JSX/markup and classNames in the screens below. If a screen needs a value the current props or hooks do not provide, stop and ask.

## File map
| Screen (screenshot) | Files |
|---|---|
| Fonts, base colors, keyframes | `app/layout.tsx`, `app/globals.css` |
| Loading | `app/loading.tsx`, `components/LoadingScreen.tsx` |
| Join (phone) | `app/join/JoinForm.tsx`, `app/join/JoinWrapper.tsx`, `app/join/page.tsx` |
| Shared phone pieces: wallet header, skeleton, errors, paused | `app/play/PlayShell.tsx` (`WalletHeader` → new `WalletBar`) |
| Auction round (phone-01..03) | `app/play/AuctionPlay.tsx` |
| Allocation (phone-04, 05) | `app/play/AllocationPlay.tsx` |
| Personal result / profile (phone-06) | `app/profile/ProfileClient.tsx` (keep the archetype section, restyle it in the same language) |
| Client logo | `components/shared/RoomBrand.tsx` |
| Projected shell + live window | `app/admin/(live)/layout.tsx`, `app/admin/(live)/rooms/[id]/live/page.tsx`, `components/admin/live/LiveWrapper.tsx`, `components/admin/live/LiveWindowBadge.tsx` |
| Live auction round (projector-01..03) | `components/admin/live/AuctionDashboard.tsx`, `components/admin/live/TraitQueue.tsx` |
| Open allocation + results (projector-04..06) | `components/admin/live/AllocationDashboard.tsx` |
| Analytics view | `components/admin/live/AnalyticsDashboard.tsx` (restyle to the tokens; no structural redesign was specified) |
| Staff shell | `app/admin/(staff)/layout.tsx`, `components/admin/StaffHeader.tsx`, `app/admin/login/*` |
| Sessions list (staff-01, staff-04) | `app/admin/(staff)/page.tsx`, `components/admin/RoomsList.tsx` |
| Create/edit session (staff-02, 03) | `app/admin/(staff)/rooms/new/page.tsx`, `app/admin/(staff)/rooms/[id]/page.tsx`, `components/admin/RoomForm.tsx`, `components/admin/TraitsEditor.tsx`, `components/admin/LogoUploader.tsx`, `components/admin/JoinShare.tsx`, `components/admin/ResetControl.tsx` |

Note: the repo's data model calls a session a "room" (`rooms` table, `RoomStatus = 'draft' | 'active' | 'ended' | 'archived'`). Only the UI copy changes to "סשן". Do not rename code, tables or routes.

## Phases (stop for approval after each)

### Phase 0: baseline
- Create the branch `redesign/board-game`.
- Install, run the app, and screenshot the current screens for a before/after comparison.
- List anything in the file map that no longer matches the repo.

### Phase 1: foundation
- In `app/layout.tsx`, add Fredoka (with the `hebrew` subset) through `next/font/google`, and keep Heebo as the fallback. Verify the export name and the subset first. Expose them as `--font-fredoka` and `--font-heebo`.
- Merge `design-kit/tokens/theme.css` into `app/globals.css`. Remove the old gold and slate visual keyframes only after their usages are replaced (search first).
- Set the base `body` to the page tint (`--color-page`) with ink text. The projector and phone backgrounds use the mint dot pattern (`.bg-dots`). Theme `::selection`, focus rings and scrollbars as the tokens specify.

### Phase 2: shared primitives
Build the components in `COMPONENTS.md` under `components/game/`: `CoinIcon`, `NumberRoller`, `WalletBar`, `ParticipantMark`, `LotTicket`, `SoldStamp`, `ProjectorCanvas`, `StatusPill`, `Stepper`, plus button and field styles. Make them stateless and drive them by props.

### Phase 3: participant phone
JoinForm, PlayShell (the WalletBar replaces WalletHeader), AuctionPlay, AllocationPlay, the waiting and sent state, and ProfileClient. Apply the COPY.md changes. Keep every existing state: loading, error, paused room, room not found, re-register.

### Phase 4: projected screen
- Wrap the projected views in `ProjectorCanvas`, an authored 1920×1080 stage scaled to fit.
- Live round: the statement card, the price token with `NumberRoller`, the leader mark, the bid ladder with FLIP animation, the countdown line, the lot queue and the close button "סגירת הסבב".
- Closing moment: the two cue beats (shown in a white card), then the strike (flash, ring, the "נמכר" sticker). The sequence runs only after the close API call succeeds. Never fake a close.
- Open allocation: the participant wall (each mark lights up when that participant submits) and the join QR card. Keep the real QR rendering that `JoinShare` already uses.
- Results: "הזוכים" prize board and "מה הקבוצה מעריכה" podium plus table (version A of both, rules below).
- The facilitator controls in `LiveWindowBadge` (extend, end room) go in the same language.

### Phase 5: staff management
Sessions list (filter by status, search, status pills, a primary action per status, the overflow menu with duplicate and archive using the existing `duplicate` and `status` routes), and the create/edit form (sections, mode cards, budget, round timer from `default_round_seconds`, statements editor, inline validation, a sticky action bar, and the locked state for an active room with participants). Add the live preview panel only if it can be fed entirely from the form's local state.

### Phase 6: needs Dor's approval (do not start without it)
- A budget unit per room (`coins` | `ils`) and a step per click. Neither exists in the schema today: allocation uses a fixed `STEP = 50` in `AllocationPlay.tsx`, and amounts are labelled "מטבעות". Propose a migration plus API changes and wait.
- Until approved: show "מטבעות" everywhere and keep the existing step values.

### Phase 7: QA
Run the acceptance criteria below and report on each one.

## Results slides: version A rules (from Shahar's spec)
- **"הזוכים":** ten statements in two rows of five, in the fixed statement order. Each plate has a dark ink band with the statement name and a sunflower strip, then the winner names, then a sunflower amount tag. A shared win lists every name with the amount shown once. With more than three winners, show three names and "ועוד N". A statement with no bids shows "לא נמכרה". Minimum sizes at 1920×1080: statement 38px, names 44px, amount 36px.
- **"מה הקבוצה מעריכה":** ranked by total invested, then by number of investors, then by the fixed statement order. Podium for places 1 to 3 (place 1 in the center and tallest, place 2 to its right, place 3 to its left, RTL), each showing statement, total and number of investors. Below it, a full-width table for places 4 to 10 with columns # / פריט / סה״כ השקעה / מספר משקיעים, text at least 36px. The reveal runs from place 3 to place 1.
- Use whatever ranking and tie data `lib/game/analytics.ts` and the allocation results already compute. If the tie-breaks above are not what the code does, report it. Do not change the logic.

## Acceptance criteria
1. `npm run build` and lint pass, and there are no new TypeScript `any`s.
2. No file in the do-not-touch list changed (`git diff --stat` proves it).
3. Every screen matches its screenshot in layout, type, color and copy. Differences are listed with a reason.
4. Phone at a 360px width: no horizontal scroll, every tap target at least 56px, body text at least 17px, the wallet bar fits on one row.
5. Projector: readable at 1920×1080. Everything is authored on the 1920 canvas and scales without reflowing.
6. With `prefers-reduced-motion`, no shake, flip or count-up runs, and every final state is still shown.
7. Contrast: body text at least 4.5:1, large text at least 3:1. Text on tomato, sunflower, sky, lilac and leaf fills is always ink, never white.
8. All COPY.md replacements are done. No remaining "מכת פטיש", "להרים שלט" or "שלט N".
9. The realtime flows still work end to end: join, bid or allocate, close, results and reset, tested with two browsers.
