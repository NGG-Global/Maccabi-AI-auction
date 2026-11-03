# Components spec

Build these under `components/evening/`. They are presentational: data comes in through props, events go out through callbacks. Values refer to DESIGN.md. Exact CSS is in `reference/prototype.html`; search for the class names given in brackets.

## CoinIcon `[#coin symbol]`
An inline SVG brass coin: a circle with the brass gradient, a darker stroke, an inner light ring and a small mark. Props: `size` (default 24) and an optional `stack` variant (`#coinStack`). It is always `aria-hidden`. Define the gradient once per page, or give each instance unique gradient ids.

## NumberRoller `[.roller]`
Animated digits. Props: `value: number` and `className`. Format with `en-US` grouping. Render each digit as a 1em-tall window over a 0 to 9 strip and translate the strip by `-digit em` over 700ms. Rebuild when the digit count changes. Set `aria-label` to the formatted value. Reduced motion: no transition.

## WalletBar `[.wbar]`
The single wallet row at the top of the phone. It replaces `WalletHeader` in `app/play/PlayShell.tsx`.
- Layout, one row: CoinIcon (34px) | label + NumberRoller + unit | the participant's ParticipantMark + name, with "מתוך {total}" under it. A 4px meter along the bottom edge.
- Props: `remaining`, `total`, `unitLabel` ("מטבעות"), `label` ("נשארו לך" in auction, "נשארו לך לחלק" in allocation), `name`, and `variant: 'dark' | 'light'` (light for the result screen).
- The meter shows `remaining / total` and is anchored to the start (right) edge. It shrinks as money is spent.
- **Auction rule:** `remaining` = total − coins already paid for won lots. A pending or leading bid does **not** reduce it (only the winner pays). The line "המטבעות יורדים מהיתרה רק אם תזכו בפריט." sits under the send button.
- **Allocation rule:** `remaining` = budget − the sum currently allocated on this phone, live as the steppers move.
- No legend and no multi-segment bar.

## ParticipantMark `[.me i, .bid .p, .wp .h, .paddle .head]`
A rounded square with the first letter of the participant's name. Sizes: 30px (phone), 52px (bid ladder), 96px (wall), 118px (leader on the projector, with a short wooden handle as the only "paddle" reference). States: default (velvet), active (ivory), leader (vermilion background in the ladder). It replaces "שלט N" numbering everywhere. It is `aria-hidden`, and the name next to it is always shown as text.

## LotTicket
The statement card. On the projector it is the main block: lot line ("פריט 03", "מתוך 07", category pill), then the statement. On the phone it is a velvet-raised card: "פריט 03" + category, then the statement at 31px.

## BidLadder `[.ladder .bids .bid]`
The last 6 bids, newest on top. Each row: mark + name + amount. The top row is highlighted vermilion. The participant's own row adds "· אתם" in ember on their phone and dashboard preview. Animate with FLIP on change. It takes its data from the existing round bids. Do not add new queries.

## CountdownLine `[.fuse]`
A 4px track with a vermilion fill and a glowing ember head that shrinks over the round's seconds (`useRoundTimer`). Under it: "הזמן בסבב" and the time. At 0: "הזמן נגמר · ממתינים לסגירת הסבב". After close: "נסגר", with the fill at 0. Closing always stays manual.

## SoldStamp `[.stamp]`
"נמכר" plus "ל{name}", vermilion, with a 12px border, rotated -9 degrees and a rough-ink mask. It slams in during the closing moment and replaces the leader mark. A small version appears in the lot queue: "נמכר · {price}". On the phone result: "נמכר לך" or "נמכר".

## Closing sequence (projector)
The close button "סגירת הסבב" calls the existing close-round action. On success, run the cues, the strike, then the sold state. On failure, show an error toast and do not play the sequence. After close, the button becomes "פתיחת הפריט הבא", which calls the existing open-round flow for the next statement in the queue.

## LotQueue `[.queue .qi]`
Horizontal chips for all statements: number, truncated title, and the state (sold stamp with price, live in ivory, waiting). The close and next button sits at the end. Keep the existing drag-and-drop reordering of unused statements if it lives here today.

## ParticipantWall `[.wall .wp]`
For open allocation. One mark per registered participant with the name under it. Not submitted: lowered and muted. Submitted: risen and ivory. The current phone's own participant gets a vermilion ring (preview only). The count above it uses NumberRoller: "{n} מתוך {total} שלחו". Amounts are never shown while open.

## PrizePlate / Winners board `[.plates .plate]`
Version A. See the rules in IMPLEMENTATION_PLAN.md. A paper plate: a 128px velvet band (lot number in mute, statement 38px), an 8px vermilion strip, names at 44px, and a vermilion amount tag. Flip-in reveal.

## Podium + ValuesTable `[.podium .pcol .vtable .vrow]`
Version A. Columns 470px wide. Bar heights: place 1 210px (vermilion), place 2 150px (ivory), place 3 104px (bronze), with the rank numeral at 84px inside the bar. Info above each bar fades in when its bar finishes. The table rows are a CSS grid `110px 1fr 360px 320px`, 52px tall, at 36px.

## Stepper `[.stepper .sbtn]`
−, value, +. Buttons 64px (round) or 52px (allocation rows), radius 18 or 14, with a velvet-raised fill and a strong border. Disabled at the bounds (opacity .35). The value is LTR.

## Phone primary button `[.cta]`
66px tall, radius 18, vermilion, with velvet-deepest serif 900 text at 27px. Labels:
- Auction: "שליחת הצעה · {amount} מטבעות". "אתם מובילים" (disabled) while leading. "אין מספיק מטבעות" when out of coins.
- Allocation: "שליחת ההצעות". When nothing is allocated: "חלקו לפחות {step}" (disabled).
Keep the label to one line at 360px.

## StatusPill `[.pill]`
For staff screens. `live`: a vermilion-tinted pill with a pulsing dot, "חי · עד HH:MM" (from the live window). `draft`: "טיוטה". `ended`: an outlined "הסתיים · DD.MM". `archived` rows are hidden by the "הכל" filter. Show them under a separate "ארכיון" filter only if the list already supports it.

## SessionRow `[.srow]`
Desktop grid: name (logo thumbnail, serif title, client line) | game type | budget (coin + number + unit) | statement count | participants | status | actions. Below 1100px it becomes a card. Actions by status:
- Active: "מסך מוקרן" (primary) + "עריכה"
- Draft: "השלמה והפעלה" (primary)
- Ended: "תוצאות" + "עריכה"
- Overflow menu: "שכפול לסשן חדש" and "העברה לארכיון". There is no delete action.

## Session editor `[#aEdit]`
Cards in order:
1. **פרטי הסשן:** name, client, slug (suggested from the title, as the current form already does), logo.
2. **סוג המשחק:** two ModeCards with small diagrams. The selected card has a vermilion border.
3. **תקציב ומטבעות:** the budget field with a coin icon, and the round timer (auction only, from `default_round_seconds`). The unit and step fields belong to phase 6 only. A rule summary line in plain Hebrew sits under the fields.
4. **פריטי המכירה:** numbered rows with text, a category select, move up and down, and remove. Keep the existing reorder mechanism. "הוספת פריט" goes at the end.

The sticky action bar holds a message on the start side, then "שמירה כטיוטה" (secondary) and "שמירה והפעלה ל־12 שעות" (primary). Validation runs on save: mark the fields, show a message with the count, and scroll and focus the first error. When locked (active and has participants): disable the game settings and statements, explain why in the bar, and allow only name, client and logo.

The optional live preview (only if it can be fed from local form state) shows a mini projector card and a mini phone WalletBar.
