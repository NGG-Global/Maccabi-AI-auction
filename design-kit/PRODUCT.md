# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Workshop participants: employees and managers in NGG client workshops (leadership programmes, service courses, maintenance staff). They join on their own phone by scanning a QR code, often in a hall with mobile data. Some are 50+ and not used to apps (Soroka maintenance workshop spec). Their job: decide what they value and put their budget behind it.
- Facilitator: an NGG consultant running the session from a laptop whose screen is projected to the room. Their job: open the game, track who joined and submitted, close it, and reveal results that start the discussion.
- NGG staff: sign in with an @nggconsult.com e-mail to create and manage rooms (title, client, client logo, game mode, budget, statements).

## Product Purpose
A live workshop exercise: participants spend a virtual budget on leadership or service statements (traits), and the results show the group what it values. The goal is the discussion about the traits, not the competition.

## Positioning
A spending decision instead of a survey: people commit a limited budget, so the results show priorities under scarcity, revealed together in the room.

## Operating Context
- One room = one workshop event, live for a 12-hour window, with its own projected screen and join QR.
- Two game modes, chosen per room: auction (one statement per round, bid and raise, only the winner pays, ties go to the earliest bid) and allocation (all statements open at once, each participant splits the wallet, top amount wins, ties are shared wins).
- Typical session around 15 minutes including results; rooms of ~15–100 participants.
- Projected results at 1920×1080: "Winners" (who won each statement and for how much) and "What the group values" (ranking by total invested, then number of investors, then fixed order).
- Personal result on the phone: what I won and what I have left.

## Capabilities and Constraints
- Hebrew, right-to-left throughout.
- Server-authoritative game logic; Supabase Realtime; Next.js 16 + Tailwind v4 on Vercel.
- Statements carry one of four fixed categories: מנהיגות, יחסים, שיפוט, למידה; a participant profile archetype is derived from them.
- Budget unit is configurable per room (coins in the leadership room; virtual ₪ with 500 steps in the Soroka spec).
- Results slides: version A chosen for both: prize board for "Winners", podium plus continuous table for "What the group values".
- Copy: plain terms only ("שליחת הצעה", "סגירת הסבב"); no paddle or hammer jargon, no participant numbers.
- Undecided: whether participant first names or nicknames appear on projected slides.

## Brand Commitments
- NGG platform that hosts a client logo per room; the look must sit alongside any client's logo.
- Visual world approved by Dor (Nov 2026): "ערב מכירה" (Evening Sale), with full freedom from the NGG design system for these surfaces. See DESIGN.md.

## Evidence on Hand
- Real statements in supabase/seed.sql; Soroka spec (10 traits, test data for 15 fictional participants) from Shahar Vider's email of 20.10.2026. Participant names in mockups are synthetic.

## Product Principles
- One screen, one action, one big button on the phone.
- The room discussion is the point; results must read from the back of the hall.
- Built for mistakes: you cannot overspend, a refresh keeps your bids.
- The facilitator always stays in control of opening and closing.

## Accessibility & Inclusion
- Large type (body ≥20px, sums ≥28px on phone), buttons ≥56px, high contrast, no pop-ups, no horizontal scroll or zoom.
