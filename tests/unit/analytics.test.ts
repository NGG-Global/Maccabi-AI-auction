import { describe, expect, it } from 'vitest'
import { computeCumulativeAnalytics, computeCurrentRoundAnalytics } from '@/lib/game/analytics'
import { computeRoundTimer } from '@/lib/hooks/useRoundTimer'
import type { AuctionRound, Participant } from '@/lib/types'

function participant(id: string, wallet: number): Participant {
  return { id, room_id: 'r', display_name: id, wallet_balance: wallet, created_at: '', last_seen_at: null }
}

describe('computeCumulativeAnalytics with a room-specific starting budget', () => {
  it('derives totals from the room starting coins, not a fixed 1,000', () => {
    const ps = [participant('a', 300), participant('b', 500)]
    const result = computeCumulativeAnalytics(ps, [], {}, 500)
    expect(result.totalStartingBudget).toBe(1000)
    expect(result.totalSpent).toBe(200)
    expect(result.totalRemainingBudget).toBe(800)
    expect(result.averageRemainingWallet).toBe(400)
  })
  it('keeps the historical default of 1,000 when no budget is given', () => {
    expect(computeCumulativeAnalytics([participant('a', 1000)], [], {}).totalStartingBudget).toBe(1000)
  })
})

describe('computeCurrentRoundAnalytics', () => {
  it('counts bidders against registered participants', () => {
    const round = { id: 'x', status: 'open', trait: { title: 'T' } } as unknown as AuctionRound
    const bids = [{ amount: 100 }, { amount: 300 }] as never
    const r = computeCurrentRoundAnalytics(round, bids, 4)
    expect(r.bidderCount).toBe(2)
    expect(r.participationRate).toBe(50)
    expect(r.highestBid).toBe(300)
    expect(r.medianBid).toBe(200)
  })
})

describe('computeRoundTimer', () => {
  const openedAt = new Date(1_000_000).toISOString()
  it('shows elapsed time without a round length', () => {
    expect(computeRoundTimer(openedAt, true, null, 1_000_000 + 65_000)).toMatchObject({ elapsed: '1:05', remaining: null, overtime: false })
  })
  it('counts down and flags overtime, without ever going negative', () => {
    expect(computeRoundTimer(openedAt, true, 90, 1_000_000 + 30_000)).toMatchObject({ remaining: '1:00', overtime: false, remainingSeconds: 60 })
    expect(computeRoundTimer(openedAt, true, 90, 1_000_000 + 95_000)).toMatchObject({ remaining: '0:00', overtime: true, remainingSeconds: 0 })
  })
  it('is idle when no round is open', () => {
    expect(computeRoundTimer(null, false, 60, 5)).toMatchObject({ elapsed: '0:00', remaining: '1:00', overtime: false })
  })
})
