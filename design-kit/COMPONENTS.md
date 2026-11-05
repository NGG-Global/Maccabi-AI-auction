# Components spec

Build these under `components/game/`. They are presentational: data comes in through props, events go out through callbacks. Values refer to DESIGN.md. Exact CSS is in `reference/prototype.html`; search for the class names given in brackets.

## CoinIcon `[#coin symbol]`
An inline SVG sunflower coin: a circle filled with the sunflower gradient (#ffe08a → #ffc83d → #f0a800), an ink stroke, an inner light ring and a small ink mark. Props: `size` (default 24) and an optional `stack` variant (`#coinStack`). It is always `aria-hidden`. Define the gradient once per page, or give each instance unique gradient ids.

## NumberRoller `[.roller]`
Animated digits. Props: `value: number` and `className`. Format with `en-US` grouping. Render each digit as a 1em-tall window over a 0 to 9 strip and translate the strip by `-digit em` over 700ms. Rebuild when the digit count changes. Set `aria-label` to the formatted value. Reduced motion: no transition.

## WalletBar `[.wbar]`
The single wallet row at the top of the phone. It replaces `WalletHeader` in `app/play/PlayShell.tsx`.
- Layout, one row inside a white card (ink outline 3px, hard shadow 5px, radius 24): CoinIcon (34px) | label + NumberRoller + unit | the participant's ParticipantMark (an ink circle with a white letter) + name, with "מתוך {total}" under it. A 7px sunflower meter along the bottom edge.
- Props: `remaining`, `total`, `unitLabel` ("מטבעות"), `label` ("נשארו לך" in auction, "נשארו לך לחלק" in allocation), `name`, and `variant: 'card' | 'tint'` (tint is the sunflower-tint background for the result screen).
- The meter shows `remaining / total` and is anchored to the start (right) edge. It shrinks as money is spent.
- **Auction rule:** `remaining` = total − coins already paid for won lots. A pending or leading bid does **not** reduce it (only the winner pays). The line "המטבעות יורדים מהיתרה רק אם תזכו בפריט." sits under the send button.
- **Allocation rule:** `remaining` = budget − the sum currently allocated on this phone, live as the steppers move.
- No legend and no multi-segment bar.

## ParticipantMark `[.me i, .bid .p, .wp .h, .paddle .head]`
A circle token with the first letter of the participant's name, an ink outline and ink text. Sizes: 30px (phone, an ink fill with a white letter), 56px (bid ladder, leaf fill, sky for the leader), 96px (wall), 108px (leader on the projector, sky fill, hard shadow 6px). There is no paddle handle. It replaces "שלט N" numbering everywhere. It is `aria-hidden`, and the name next to it is always shown as text.

## LotTicket
The statement card: a white card with a 4px ink outline, radius 32, a 9px hard shadow and a -0.8 degree tilt. Two tabs overlap its top edge: "פריט 3 מתוך 7" (tomato) and the category (sky). On the phone it is the same card at the phone scale (3px outline, 5px shadow, -0.6 degree tilt) with a "פריט 03" tomato tab and the statement at 28px.

## BidLadder `[.ladder .bids .bid]`
Inside a white outlined card titled "הצעות אחרונות". The last 6 bids, newest on top. Each row is an outlined white pill (radius 22, 80px tall): token + name + amount. The top row is sunflower. The participant's own row adds "· אתם" in dark tomato (#b23a1f). Animate with FLIP on change. It takes its data from the existing round bids. Do not add new queries.

## CountdownLine `[.fuse]`
A 20px white track with a 4px ink outline. Its fill (a tomato to sunflower gradient) shrinks from the left over the round's seconds (`useRoundTimer`). Under it: "הזמן בסבב" and the time. At 0: "הזמן נגמר · ממתינים לסגירת הסבב". After close: "נסגר", with the fill at 0. Closing always stays manual.

## SoldStamp `[.stamp]`
A sticker: "נמכר" (120px, 700) plus "ל{name}" (40px), ink text on tomato, a 6px ink outline, radius 30, an 8px hard shadow, rotated -9 degrees. It slams in during the closing moment and replaces the leader token. A small version sits on the lot-queue card ("נמכר · {price}", rotated -6 degrees, overlapping the card's top edge). On the phone result: "נמכר לך" or "נמכר".

## Closing sequence (projector)
The cues "N · פעם ראשונה" and "N · פעם שנייה" appear in a white outlined card centered above the countdown. The close button "סגירת הסבב" calls the existing close-round action. On success, run the cues, the strike, then the sold state. On failure, show an error toast and do not play the sequence. After close, the button becomes "פתיחת הפריט הבא", which calls the existing open-round flow for the next statement in the queue.

## LotQueue `[.queue .qi]`
Small white outlined cards (radius 22, 104px tall) for all statements: number, truncated title, and the state (the sold sticker with price; the live one is sunflower, raised 12px with a 6px shadow; the waiting ones are plain). The close and next button sits at the end. Keep the existing drag-and-drop reordering of unused statements if it lives here today.

## ParticipantWall `[.wall .wp]`
For open allocation. One round token per registered participant with the name under it. Not submitted: lowered 34px, with a dashed muted outline and a translucent white fill. Submitted: it pops up, gets a solid ink outline, a 6px hard shadow and a player color (cycle sky, lilac, peach). The current phone's own participant is sunflower with a tomato ring (preview only). The count above it uses NumberRoller: "{n} מתוך {total} שלחו". Amounts are never shown while open.

## PrizePlate / Winners board `[.plates .plate]`
Version A. See the rules in IMPLEMENTATION_PLAN.md. A white plate with a 4px ink outline, radius 26 and a 7px hard shadow. Inside: a 116px ink band (lot number in #a9b7c4, statement 38px white), a 10px sunflower strip with an ink bottom rule, names at 44px 700, and a sunflower amount tag with an ink outline. Flip-in reveal.

## Podium + ValuesTable `[.podium .pcol .vtable .vrow]`
Version A. Columns 470px wide. Bar heights: place 1 196px (sunflower), place 2 140px (sky), place 3 96px (lilac). Each bar has a 5px ink outline (no bottom edge), radius 24 on top, and the rank numeral at 84px in ink inside it. Place 1's total is in dark tomato (#c24a2c). Info above each bar fades in when its bar finishes. The table sits in a white outlined card (4px, radius 24, 7px shadow). Its rows are a CSS grid `110px 1fr 360px 320px`, 49px tall, at 36px, with zebra rows (#f3f8f5) and an ink rule under the header.

## Stepper `[.stepper .sbtn]`
−, value, +. Round white buttons, 64px (auction) or 52px (allocation rows), with a 3px (2.5px) ink outline and a 3px (2px) hard shadow, and a pressed state. Disabled at the bounds (opacity .35, no shadow). The value is LTR. In auction the value has a small coin icon next to it.

## Phone primary button `[.cta]`
64px tall, radius 22, tomato, with a 3px ink outline, a 5px hard shadow and a pressed state. The text is ink, 700, 23px. Disabled: #e4ece8, ink-3 text, a muted outline and no shadow. Labels:
- Auction: "שליחת הצעה · {amount} מטבעות". "אתם מובילים" (disabled) while leading. "אין מספיק מטבעות" when out of coins.
- Allocation: "שליחת ההצעות". When nothing is allocated: "חלקו לפחות {step}" (disabled).
Keep the label to one line at 360px.

## StatusPill `[.pill]`
For staff screens, with a 2px ink outline. `live`: leaf with a pulsing dark-green dot, "חי · עד HH:MM" (from the live window). `draft`: light grey, "טיוטה". `ended`: white with a muted outline, "הסתיים · DD.MM". `archived` rows are hidden by the "הכל" filter. Show them under a separate "ארכיון" filter only if the list already supports it.

## SessionRow `[.srow]`
A white row with a 2.5px ink outline, radius 20 and a 4px hard shadow. An active row has a warm #fffaf0 fill. Desktop grid: name (logo thumbnail, title at 600, client line) | game type | budget (coin + number + unit) | statement count | participants | status | actions. Below 1100px it becomes a card. Actions by status:
- Active: "מסך מוקרן" (primary) + "עריכה"
- Draft: "השלמה והפעלה" (primary)
- Ended: "תוצאות" + "עריכה"
- Overflow menu: "שכפול לסשן חדש" and "העברה לארכיון". There is no delete action.

## Session editor `[#aEdit]`
Cards in order:
1. **פרטי הסשן:** name, client, slug (suggested from the title, as the current form already does), logo.
2. **סוג המשחק:** two ModeCards with small diagrams. Unselected: a muted outline. Selected: an ink outline, a sunflower-tint fill and a 4px hard shadow.
3. **תקציב ומטבעות:** the budget field with a coin icon, and the round timer (auction only, from `default_round_seconds`). The unit and step fields belong to phase 6 only. A rule summary line in plain Hebrew sits under the fields.
4. **פריטי המכירה:** numbered rows with text, a category select, move up and down, and remove. Keep the existing reorder mechanism. "הוספת פריט" goes at the end.

Cards: white, 2.5px ink outline, radius 24, 5px hard shadow. Inputs: white, 2px ink outline, radius 12, focus ring 4px sunflower. Errors: #b42318 text and border with a #fff5f2 fill. The sticky action bar (white at 92% opacity, outlined) holds a message on the start side, then "שמירה כטיוטה" (secondary) and "שמירה והפעלה ל־12 שעות" (primary). Validation runs on save: mark the fields, show a message with the count, and scroll and focus the first error. When locked (active and has participants): disable the game settings and statements, explain why in the bar, and allow only name, client and logo.

The optional live preview (only if it can be fed from local form state) shows a mini projector card and a mini phone WalletBar.
