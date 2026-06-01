import type { Bid } from '@/lib/types'

export interface WinnerResult {
  winnerId: string
  winningAmount: number
}

/**
 * Determine winner from a list of final bids.
 * Rules:
 * - Highest amount wins.
 * - Tie broken by earliest updated_at (first to reach that amount).
 * Returns null if no bids exist.
 */
export function determineWinner(bids: Bid[]): WinnerResult | null {
  if (bids.length === 0) return null

  const sorted = [...bids].sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount
    // Earlier updated_at wins the tie
    return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  })

  const top = sorted[0]
  return { winnerId: top.participant_id, winningAmount: top.amount }
}
