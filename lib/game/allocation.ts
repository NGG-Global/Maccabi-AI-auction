import type { AuctionRound, GameMode } from '@/lib/types'

import { EMBED } from '@/lib/supabase/embeds'

/** PostgREST embed for the allocation winner list (round_winners, migration 009). */
export const ROUND_WINNERS_SELECT = EMBED.roundWinners

/** Names of everyone who won the round, falling back to the single winner. */
export function roundWinnerNames(round: AuctionRound): string[] {
  if (round.winners && round.winners.length > 0) {
    return round.winners
      .map(w => w.participant?.display_name ?? '—')
      .sort((a, b) => a.localeCompare(b, 'he'))
  }
  return round.winner?.display_name ? [round.winner.display_name] : []
}

export function isRoundWinner(round: AuctionRound, participantId: string): boolean {
  if (round.winners && round.winners.length > 0) {
    return round.winners.some(w => w.participant_id === participantId)
  }
  return round.winner_participant_id === participantId
}

// Pure helpers for the budget-allocation mode. Winners and charges are
// decided server-side by close_allocation (migration 008); everything here
// is input checking and display.

export function resolveGameMode(mode: string | null | undefined): GameMode {
  return mode === 'allocation' ? 'allocation' : 'auction'
}

/** Parses an amount input. Empty means 0; anything else must be a whole number ≥ 0. */
export function parseAllocationInput(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return 0
  if (!/^\d+$/.test(trimmed)) return null
  const n = Number(trimmed)
  return Number.isSafeInteger(n) ? n : null
}

export interface AllocationDraftCheck {
  valid: boolean
  total: number
  remaining: number
  error: string | null
}

export function checkAllocationDraft(
  draft: Record<string, string>,
  walletBalance: number,
): AllocationDraftCheck {
  let total = 0
  for (const value of Object.values(draft)) {
    const n = parseAllocationInput(value)
    if (n === null) {
      return { valid: false, total, remaining: walletBalance - total, error: 'יש להזין מספרים שלמים בלבד' }
    }
    total += n
  }
  const remaining = walletBalance - total
  if (remaining < 0) {
    return { valid: false, total, remaining, error: `חריגה של ${(-remaining).toLocaleString()} מטבעות מהיתרה` }
  }
  return { valid: true, total, remaining, error: null }
}

/** Converts a draft to the payload for /api/allocation/submit (every open round, zeros included). */
export function draftToPayload(draft: Record<string, string>): Record<string, number> {
  const payload: Record<string, number> = {}
  for (const [roundId, value] of Object.entries(draft)) {
    payload[roundId] = parseAllocationInput(value) ?? 0
  }
  return payload
}

export interface AllocationTraitResult {
  roundId: string
  traitTitle: string
  category: string | null
  sortOrder: number
  totalAllocated: number
  supporterCount: number       // participants who put more than 0 on this trait
  averageAllocation: number | null
  sharePercent: number         // share of all coins allocated by the group, 0–100
  winnerNames: string[]        // more than one = shared win (tie on the top amount)
  winningAmount: number | null
}

export interface AllocationBidRow {
  round_id: string
  amount: number
}

/**
 * Per-trait group totals, sorted by total allocated (highest first).
 * Winner fields come from the closed round rows written by close_allocation.
 */
export function summarizeAllocation(
  rounds: AuctionRound[],
  bids: AllocationBidRow[],
): AllocationTraitResult[] {
  const amountsByRound = new Map<string, number[]>()
  for (const b of bids) {
    const list = amountsByRound.get(b.round_id)
    if (list) list.push(b.amount)
    else amountsByRound.set(b.round_id, [b.amount])
  }
  const grandTotal = bids.reduce((s, b) => s + b.amount, 0)

  return rounds
    .map(round => {
      const amounts = amountsByRound.get(round.id) ?? []
      const totalAllocated = amounts.reduce((s, v) => s + v, 0)
      return {
        roundId: round.id,
        traitTitle: round.trait?.title ?? '—',
        category: round.trait?.category ?? null,
        sortOrder: round.trait?.sort_order ?? 0,
        totalAllocated,
        supporterCount: amounts.length,
        averageAllocation: amounts.length > 0 ? Math.round(totalAllocated / amounts.length) : null,
        sharePercent: grandTotal > 0 ? Math.round((totalAllocated / grandTotal) * 100) : 0,
        winnerNames: roundWinnerNames(round),
        winningAmount: round.winning_bid_amount,
      }
    })
    .sort((a, b) => b.totalAllocated - a.totalAllocated || a.sortOrder - b.sortOrder)
}

/** Allocation rounds share one opened_at/closed_at, so order them by the trait list. */
export function sortRoundsByTrait<T extends AuctionRound>(rounds: T[]): T[] {
  return [...rounds].sort((a, b) => (a.trait?.sort_order ?? 0) - (b.trait?.sort_order ?? 0))
}
