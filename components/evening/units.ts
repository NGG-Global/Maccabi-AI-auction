/**
 * Budget wording and steps for the "Evening Sale" UI.
 *
 * A per-room unit (coins | ₪) and a per-click step are phase 6 of the
 * redesign and need a schema change, so until then every room shows
 * "מטבעות" and the steps below are presentational constants.
 */
export const UNIT_LABEL = 'מטבעות'

/** Allocation steppers: the value the old UI already used. */
export const ALLOCATION_STEP = 50

/** Auction steppers: the amount is still free text, the buttons move it by this much. */
export const AUCTION_STEP = 10

/** en-US grouping; always rendered inside a `.num` (LTR, tabular) span. */
export function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

/** Two-digit lot number: "03". */
export function lotNo(index1: number): string {
  return String(index1).padStart(2, '0')
}

/** First letter of a display name, for ParticipantMark. */
export function initial(name: string | null | undefined): string {
  return (name ?? '').trim().charAt(0) || '·'
}
