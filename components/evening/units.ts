/**
 * Budget wording for the "Evening Sale" UI.
 *
 * The step per click is a room setting (`rooms.bid_step`, migration 013).
 * A per-room unit (coins | ₪) is still pending a decision, so every room
 * shows "מטבעות".
 */
export const UNIT_LABEL = 'מטבעות'

/** The step a room gets when none was set: 10 in auction mode, 50 in allocation mode. */
export function defaultBidStep(mode: 'auction' | 'allocation', coins: number): number {
  return Math.min(mode === 'allocation' ? 50 : 10, Math.max(1, Math.floor(coins / 2)))
}

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
