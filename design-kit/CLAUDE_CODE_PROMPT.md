# Task: re-skin the auction app to the approved "Board Game" design

You are working in the repo `NGG-Global/Maccabi-AI-auction` (Next.js App Router, React, Tailwind v4, Supabase). The design kit is in `design-kit/` at the repo root. Your job is to replace the visual layer of the whole app with the approved design while keeping all game logic, data flow, API routes and database behavior exactly as they are.

## Read first, in this order
1. `design-kit/IMPLEMENTATION_PLAN.md`: phases, the file map, the do-not-touch list and the acceptance criteria. Follow it.
2. `design-kit/DESIGN.md`: the tokens and rules. Tokens are normative.
3. `design-kit/COMPONENTS.md`: specs for the new shared components.
4. `design-kit/COPY.md`: every user-facing string that changes.
5. `design-kit/reference/prototype.html`: open it in a browser (or read its CSS and JS) for exact values and motion timing. The prototype was built by re-theming an earlier dark design, so its stylesheet has a base layer plus a block marked "BOARD GAME THEME (direction C)" that overrides it. Where the two conflict, the override block and DESIGN.md are the truth. Ignore the dark base values. Use it as a visual and behavioral reference only. Do not paste it into the app. Rebuild each element as React + Tailwind using the tokens.
6. `design-kit/reference/screenshots/`: the target look for every screen and state.

## Working rules
- Create a branch `redesign/board-game` before editing. Never push to `main`. Do not open a PR unless asked.
- Work phase by phase as listed in the plan. After each phase, run `npm run build` and `npm run lint` (check `package.json` for the exact script names first), fix what breaks, summarize what changed, and stop for my approval before starting the next phase.
- Presentation only. Do not change files under `lib/game/`, `app/api/`, `lib/supabase/`, `lib/auth/`, `supabase/` or the realtime hooks, except where the plan explicitly allows a small presentational addition. If a design element seems to need new data or a schema change, stop and ask me. Do not invent it.
- Keep Hebrew RTL everywhere. Numbers render LTR inside RTL text (`dir="ltr"` or `unicode-bidi: isolate` on numeric spans).
- Every animation must respect `prefers-reduced-motion`.
- Do not guess APIs. If you are not certain a library function or a `next/font/google` export exists (for example `Fredoka` with the `hebrew` subset), check `node_modules` or the official docs before using it, and tell me what you verified.
- Keep accessibility: real `<button>` and `<input>` elements, visible focus rings, contrast at least 4.5:1 for body text (dark ink on the colored fills, never white on yellow or green), touch targets of at least 56px on the participant phone screens.
- Where the current UI has states the prototype does not show (loading, errors, empty lists, a reset room, a lost connection), design them in the same language. Do not drop them.

## When you finish all phases
Give me a short report covering: what changed per screen, anything you could not match and why, anything that needs a decision from me (especially phase 6), and how to run it locally to review.

Start now with phase 0 from the plan.
