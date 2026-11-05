---
name: המכירה הפומבית · משחק קופסה (Modern Board Game)
description: Live workshop auction for NGG. A friendly modern board game on the projector and in every participant's hand.
colors:
  ink: "#1f2a37"
  ink-2: "#3d4a5a"
  ink-3: "#5b6675"
  mint: "#dff3e9"
  mint-line: "#c9dcd2"
  page: "#eef6f1"
  card: "#ffffff"
  zebra: "#f3f8f5"
  tomato: "#ff6b4a"
  tomato-hover: "#ff8466"
  sunflower: "#ffc83d"
  sunflower-tint: "#fff1c4"
  sky: "#7cc0ff"
  lilac: "#c4b5fd"
  peach: "#ffb48f"
  leaf: "#9be3bf"
  error: "#b42318"
  muted-outline: "#9aa9b5"
typography:
  display:
    fontFamily: "Fredoka"
    fontWeight: 700
  title:
    fontFamily: "Fredoka"
    fontWeight: 600
  body:
    fontFamily: "Fredoka"
    fontWeight: 500
  fallback:
    fontFamily: "Heebo"
rounded:
  sm: 12px
  md: 18px
  lg: 24px
  xl: 32px
  pill: 999px
---

# Design System: המכירה הפומבית · משחק קופסה

## Overview

**Creative North Star: "The Table Game"**

The auction is a modern board game played around a table. Every statement is a card, every bid is a token, and money is a sunflower coin. Pieces are white cards with a thick ink outline and an offset hard shadow, so they look like they could be picked up. The room is light, warm and friendly, built for workshop halls with the lights on and for participants who are not used to apps.

The projector is the board: one big card for the lot, a big sunflower coin token for the price, players as colored round tokens. The phone is the player's hand: the wallet, the card, the coin and one big button. The staff screens are the game box: the same pieces, calmer, built for setup.

**Key characteristics**
- A light mint ground with a soft dot grid. White cards on top.
- An ink outline (2.5 to 5px) and an offset hard shadow (3 to 9px, no blur) on every interactive or game piece.
- A rounded sans-serif (Fredoka) everywhere. No serif.
- Color carries meaning: sunflower = money and first place, tomato = action and "sold", sky / lilac / peach / leaf = players and places 2 and 3.
- Text on any colored fill is ink. Never white.

**Rejected:** dark backgrounds, serif type, vermilion and velvet (the previous "Evening Sale" direction), gold glow, glass, emoji, and paddle or hammer jargon.

## Colors

### Primary
- **Sunflower** (#ffc83d): money. The price token, the coin icon, the wallet meter, the live lot card, first place, the amount tags on prize plates, the leading bid row.
- **Tomato** (#ff6b4a, hover #ff8466): action. Primary buttons ("שליחת הצעה", "סגירת הסבב", "סשן חדש"), the "נמכר" sticker, the lot-number tab, the live dot.

### Secondary (players and places)
- **Sky** (#7cc0ff): the leading player's token, the category tab, place 2.
- **Lilac** (#c4b5fd): place 3, and alternate player tokens.
- **Peach** (#ffb48f) and **Leaf** (#9be3bf): alternate player tokens. Leaf also marks the "live" status pill and the "אתם מובילים" status.

### Neutral
- **Ink** (#1f2a37): all text, all outlines, all hard shadows, the dark band on prize plates, and selected tabs (with white text).
- **Ink 2** (#3d4a5a): secondary text. **Ink 3** (#5b6675): labels and hints (about 6:1 on white). Never lighter for text.
- **Mint** (#dff3e9) with a dot grid: the projector and phone background. **Page** (#eef6f1): the staff page background.
- **Card** (#ffffff): every card, row, input and plate. **Zebra** (#f3f8f5): alternate table rows.
- **Sunflower tint** (#fff1c4): soft highlight (allocated rows, hover, the checked mode card).
- **Muted outline** (#9aa9b5): dashed placeholders (pending participants, the logo slot), unselected mode cards and disabled outlines.
- **Error** (#b42318): validation text and borders.

### Named rules
**The Ink-On-Color Rule.** Text on tomato, sunflower, sky, lilac, peach or leaf is always ink. White text appears only on ink.
**The Money Is Sunflower Rule.** Anything that is an amount of coins or ₪ in focus sits on, or next to, sunflower. Nothing else is sunflower except first place.

## Typography

**Family:** Fredoka (Google Fonts, has Hebrew), weights 400, 500, 600 and 700. Fallback: Heebo, system-ui, sans-serif.
Numbers: Fredoka 700 with `font-variant-numeric: tabular-nums`, isolated LTR.

### Hierarchy: projector (1920×1080 canvas)
- Lot statement: 600, 96px, line-height 1.06, max 2 lines, `text-wrap: balance`
- Price inside the token: 700, 118px. The unit inside it: 600, 28px
- Slide titles: 700, 112px. "המכירה פתוחה": 700, 150px. Submission count: 700, 190px, tomato
- Leader name: 700, 58px. Bid ladder: name 28px 500, amount 36px 700
- Prize plates: statement 38px 600 (white on ink band), names 44px 700, amount tag 36px 700
- Podium: statement 40px, total 52px, investors 28px. Table: 36px, rows 49px tall
- Meta row: 26px. Lot tabs: 24 to 26px 700

### Hierarchy: phone
- Card statement: 600, 28px. Wallet amount: 700, 34px. Highest bid inside a 96px token: 700, 34px
- Stepper value: 700, 44px. Primary button: 700, 23px, height 64px
- Allocation rows: 500, 19px, amount 700, 24px. Body and hints: 14 to 20px. Nothing below 14px

### Hierarchy: staff
- Page title: 700, 46px. Card title: 700, 26px. Body: 15 to 16px. Labels: 14px 600. Hints: 13px ink-3

## Layout
The same structure as the approved prototype:
- **Projector:** a fixed 1920×1080 stage (`ProjectorCanvas`) scaled to fit.
  - Round: main | 430px ladder card, rows of 56px meta / content / 132px queue.
  - Open allocation: main | 520px QR card.
  - Winners: meta / title / a 5×2 plate grid with 22px gaps.
  - Values: meta / title / a 372px podium / the table card.
- **Phone:** one column, max 430px. Wallet bar at the top, content in the middle, a sticky action area at the bottom with a translucent white background and an ink top rule.
- **Staff:** max width 1280px. The list rows become cards below 1100px. The editor is the form beside a 420px sticky preview, stacking below 1100px.
- **Spacing:** 4px base. Pieces are separated by at least the size of their hard shadow, so shadows never touch neighbours.

## Elevation & Depth
No blur shadows. Depth comes only from the hard offset shadow in ink: `Npx Npx 0 #1f2a37`.
- Projector pieces: 6 to 9px. Phone pieces: 3 to 5px. Staff pieces: 3 to 5px.
- **Pressed state:** translate the element by the shadow size minus 1 to 2px, and reduce the shadow by the same amount. The piece looks pushed into the table.
- Disabled pieces lose their shadow and take the muted outline.

## Shapes
Radius 12 / 18 / 24 / 32 / pill. Player tokens and the price token are circles. The lot card and phone card tilt slightly (-0.6 to -0.8 degrees). The tabs on the lot card (lot number in tomato, category in sky) sit on the card's top edge and overlap it by 30px. The "נמכר" sticker is a tomato rounded rectangle with an ink outline, rotated -6 to -9 degrees.

## Motion
Ease-out `cubic-bezier(.16,1,.3,1)`. Timings are the same as the prototype:
- Number roller: 700ms.
- Bid ladder: FLIP 420ms.
- Closing cue: two beats, 950ms apart, in a white outlined card.
- Strike at 1900ms: a sunflower flash of 750ms, a 320ms shake, a 420ms sticker slam and a 900ms ink ring.
- Participant wall: a token pops up over 700ms and gets its color.
- Plates: flip in over 800ms, staggered 90ms.
- Podium: bars grow in the order 3, 2, 1, each over 900ms, 1100ms apart, with the totals counting up.
- Buttons press over 100ms.
- `prefers-reduced-motion`: show the final states only.

## Components
See COMPONENTS.md.

## Do's and Don'ts
**Do:** use ink text on every color, keep one dominant number per phone screen, use the coin token for money, keep pieces outlined and shadowed, and write copy in plain Hebrew.
**Don't:** use white text on yellow or green, blur shadows, gradients on surfaces (the countdown fill is the only gradient), more than three player colors next to each other in one row, serif fonts, dark screens, or jargon.
