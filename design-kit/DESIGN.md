---
name: ערב מכירה (Evening Sale)
description: Live workshop auction for NGG. A theatrical evening sale room on the projector, and a calm coin wallet in every participant's hand.
colors:
  velvet-deepest: "#0d080b"
  velvet-ground: "#160e12"
  velvet-raised: "#211519"
  velvet-line: "#33232a"
  velvet-line-strong: "#4a333c"
  ivory: "#f4ecdf"
  ivory-dim: "#cfc2b1"
  ivory-mute: "#a39585"
  hammer-vermilion: "#ff5a36"
  hammer-vermilion-hover: "#ff6d4d"
  vermilion-deep: "#d93a1a"
  ember: "#ffb38a"
  podium-bronze: "#b98a5e"
  catalogue-paper: "#efe5d4"
  ink-on-paper: "#1d1316"
  ink-soft: "#5b4a4f"
  error-text: "#ff9d82"
typography:
  display:
    fontFamily: "Frank Ruhl Libre"
    fontWeight: 900
  title:
    fontFamily: "Frank Ruhl Libre"
    fontWeight: 700
  body:
    fontFamily: "IBM Plex Sans Hebrew"
    fontWeight: 400
  label:
    fontFamily: "IBM Plex Sans Hebrew"
    fontWeight: 600
rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 18px
  xl: 22px
  pill: 999px
---

# Design System: ערב מכירה

## Overview

**Creative North Star: "The Evening Sale"**

Every statement is a lot on the block in an evening auction. The facilitator runs the sale, and the projector is the sale-room board under a warm spotlight. Statements and prices are set in a heavy Hebrew serif, like a catalogue. Vermilion is the hammer: it marks the leading bid, the sold stamp and first place, and nothing decorative. The participant's phone is the quiet counterpart: one lot, one number for what you have left, and one big send button.

The projector is theatre (Experience). The phone and the staff screens are tools (Operate): standard controls, high clarity, and the world shows only through type, palette and a few signature details.

**Key characteristics**
- A dark velvet ground with a single warm spotlight and a faint grain. Never pure black.
- Ivory type. A heavy serif for content (statements, numbers, titles) and a clean sans for UI.
- One accent (vermilion), used sparingly. Its rarity is the point.
- Catalogue plates in ivory paper for results.
- Money is coins: a brass coin icon and rolling digits.

**Rejected:** the previous look (slate-950, glowing gold, glass, emoji), the light NGG design system for these surfaces, and paddle or hammer jargon in the copy.

## Colors

### Primary
- **Hammer Vermilion** (#ff5a36): the leading bid, the price on the block, the sold stamp, place 1, primary buttons (with velvet-deepest text, contrast about 6:1). Hover #ff6d4d.
- **Ember** (#ffb38a): the countdown line head, the "you" marker in the bid ladder, the outbid status.

### Neutral
- **Velvet Ground** (#160e12): the page and screen background.
- **Velvet Deepest** (#0d080b): outside the stage, and text on vermilion or ivory buttons.
- **Velvet Raised** (#211519): cards, bid rows, list rows, inputs on cards.
- **Velvet Line** (#33232a) and **Line Strong** (#4a333c): borders and dividers, the empty meter track.
- **Ivory** (#f4ecdf): primary text, a selected tab, a submitted participant mark, place 2.
- **Ivory Dim** (#cfc2b1): secondary text (about 10:1 on the ground).
- **Ivory Mute** (#a39585): tertiary text, labels, hints (about 6:1 on the ground). Never go lower.
- **Catalogue Paper** (#efe5d4) with **Ink on Paper** (#1d1316) and **Ink Soft** (#5b4a4f): result plates and the light wallet bar.
- **Podium Bronze** (#b98a5e): place 3 only.
- **Coin brass gradient** (#f6dcae → #cf9a62 → #8a5c3b, stroke #6e4629): the coin icon and the wallet meter fill only.
- **Error text** (#ff9d82): validation messages and error borders.

### Named rules
**The One Hammer Rule.** Vermilion appears only where something is winning, sold or primary. If two vermilion things compete on one screen, one of them is wrong.
**The No Grey Rule.** Secondary text is tinted ivory (dim or mute), never neutral grey.

## Typography

**Display:** Frank Ruhl Libre 900 (fallback: "David Libre", Georgia, serif)
**Title:** Frank Ruhl Libre 700
**Body / UI:** IBM Plex Sans Hebrew 400, 500, 600 and 700 (fallback: Assistant, system-ui, sans-serif)

Numbers are always Frank Ruhl Libre 900 with `font-variant-numeric: tabular-nums lining-nums`, isolated LTR.

### Hierarchy: projector (authored on a 1920×1080 canvas)
- Lot statement: 900, 118px, line-height 1.02, letter-spacing -0.018em, max 2 lines, `text-wrap: balance`
- Price on the block: 900, 232px, line-height .86, vermilion
- Slide titles ("הזוכים", "מה הקבוצה מעריכה"): 900, 112px
- "המכירה פתוחה": 900, 150px. Submission count: 900, 190px
- Bid ladder: names 28px Plex 600, amounts 40px serif 900
- Results plates: statement 38px serif 700, names 44px serif 900, amount 36px serif 900
- Values table: 36px. Podium statement 40px, total 52px, investors 28px
- Meta row: 26px Plex. Room title 30px serif 700

### Hierarchy: phone
- Lot statement: serif 900, 31px, line-height 1.12
- Wallet amount: serif 900, 34px. Label 14px Plex
- Highest bid: serif 900, 60px, vermilion. Stepper value: serif 900, 44px
- Primary button: serif 900, 27px, height 66px
- Allocation rows: statement 19px Plex 600, amount 24px serif 900
- Body and hints: 15 to 20px Plex. Nothing below 14px

### Hierarchy: staff
- Page title: serif 900, 46px. Card title: serif 700, 26px
- Body: 15 to 16px Plex. Labels: 14px Plex 600. Hints: 13px ivory-mute

**The Serif Is Content Rule.** Frank Ruhl Libre is for content (statements, numbers, names, titles). Controls, labels and helper text are always Plex.

## Layout

- **Projector:** a fixed 1920×1080 stage (`ProjectorCanvas`) scaled uniformly to fit the viewport, letterboxed on velvet-deepest. Padding 64px 96px 56px.
  - Round: two columns (main | 430px bid ladder, the ladder on the left in RTL), rows of 56px meta / content / 132px lot queue.
  - Open allocation: two columns (main | 520px QR card).
  - Winners: meta / 104px title / a 5×2 plate grid with 22px gaps.
  - Values: meta / title / a 404px podium / the table.
- **Phone:** a single column, max 430px. Top: the wallet bar. Middle: content (scrolls in allocation). Bottom: a sticky action area with the primary button. Side padding 14 to 18px.
- **Staff:** max width 1280px. The list is a grid of rows that collapse into cards below 1100px. The editor is the form beside a 420px sticky preview, stacking below 1100px with the preview on top. The action bar is sticky at the bottom.
- **Spacing:** 4px base. Groups at 8 to 16px, sections at 18 to 28px.

## Elevation & Depth

Depth comes from tone (velvet layers) plus a soft, offset ambient shadow. No glow halos and no glass, except the staff sticky action bar (backdrop blur 12px).
- Stage / phone frame: `0 30px 80px rgba(0,0,0,.55)`
- Raised card or plate: `0 24px 50px rgba(0,0,0,.45)`
- Primary button: `0 12px 30px rgba(255,90,54,.28)`
- Menus and toasts: `0 18px 40px rgba(0,0,0,.5)`
- Spotlight: a radial ellipse of warm light (rgba(255,214,170,.13)) at 50% 18% on the projector only. Grain: SVG fractal noise at .18 opacity in overlay blend.

## Shapes

Radius 4 / 8 / 12 / 18 / 22 / 999. Phone buttons and steppers 18px. Cards 14 to 20px. Pills 999px. The sold stamp has a 12px border, rotated -9 degrees, with a rough-ink mask. Participant marks are rounded squares holding the name's first letter.

## Motion

Ease-out `cubic-bezier(.16,1,.3,1)` throughout. No bounce, except the stamp's single slam overshoot.
- **NumberRoller:** each digit is a vertical strip that translates over 700ms.
- **Bid ladder:** FLIP. Existing rows slide 420ms, and the new row drops in (from -30px with blur 4px to sharp).
- **The closing moment (signature):** cue "N · פעם ראשונה" at 0ms and "N · פעם שנייה" at 950ms (1s cue animation), then the strike at 1900ms: flash 750ms, content shake 320ms (5px max), stamp slam 420ms (scale 2.3 to 1, rotate -16 to -9 degrees, blur 10 to 0), and a ring expanding 900ms. The leader mark fades out and the stamp takes its place. Play it only after the server confirms the close.
- **Participant wall:** a submitted mark rises (translateY 46px to 0) over 700ms and turns ivory.
- **Winners:** plates flip in (rotateY -88 degrees to 0) over 800ms, staggered 90ms in statement order.
- **Values:** podium bars grow over 900ms in the order 3, 2, 1, 1100ms apart. Totals count up over 900ms (ease-out quart, rounded to the step). Table rows fade in at a 70ms stagger after the podium.
- **Reduced motion:** every duration goes to near zero and the final state shows immediately.

## Components

See COMPONENTS.md for props, states and behavior. The core set: CoinIcon, NumberRoller, WalletBar, ParticipantMark, LotTicket, BidLadder, SoldStamp, CountdownLine, ParticipantWall, PrizePlate, Podium, ValuesTable, StatusPill, Stepper, ModeCard, SessionRow, ItemsEditor, and buttons (primary, secondary, small).

## Do's and Don'ts

**Do**
- Keep one number per phone screen dominant: what you have left, or the price.
- Show money with the coin icon and rolling digits.
- Write copy in plain Hebrew: "שליחת הצעה", "סגירת הסבב", "נשארו לך".

**Don't**
- Don't use emoji, gradient text, glass cards, glowing gold or colored side borders.
- Don't show more than one wallet figure, and don't use multi-part legends on the phone.
- Don't use paddle or hammer jargon in labels.
- Don't let vermilion decorate.
