import type { AuctionRound, Bid, Participant } from '@/lib/types'

// ─── Connection status ────────────────────────────────────────────────────────

export type RealtimeConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

// ─── Current-round analytics ──────────────────────────────────────────────────

export interface CurrentRoundAnalytics {
  roundId: string | null
  status: 'waiting' | 'open' | 'closed'
  traitTitle: string | null
  traitDescription: string | null
  openedAt: string | null
  registeredParticipants: number
  bidderCount: number
  participationRate: number   // 0–100 integer
  highestBid: number | null
  averageBid: number | null
  medianBid: number | null
  lowestBid: number | null
  totalCommitted: number      // sum of all bids (display only — only winner actually pays)
  winnerName: string | null
  winningBid: number | null
}

// ─── Cumulative analytics ─────────────────────────────────────────────────────

export interface TraitRanking {
  traitId: string
  traitTitle: string
  roundId: string
  winningBid: number | null   // amount the winner paid
  bidderCount: number
  averageBid: number | null   // average of all bids submitted
  winnerName: string | null
}

export interface CumulativeGameAnalytics {
  totalStartingBudget: number         // registeredCount * 1000
  totalSpent: number                  // totalStartingBudget - sum(wallet_balance)
  totalRemainingBudget: number        // sum(wallet_balance)
  averageRemainingWallet: number
  completedRounds: number
  traitRankings: TraitRanking[]       // sorted by winningBid desc
}

// ─── Pure computation helpers ─────────────────────────────────────────────────

/**
 * Returns the median of a non-empty sorted or unsorted array of numbers,
 * or null if the array is empty.
 */
export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

/**
 * Derives all current-round metrics from raw data.
 * Pure function — no side effects, fully testable.
 */
export function computeCurrentRoundAnalytics(
  round: AuctionRound | null,
  bids: Bid[],
  registeredParticipants: number,
): CurrentRoundAnalytics {
  if (!round) {
    return {
      roundId: null,
      status: 'waiting',
      traitTitle: null,
      traitDescription: null,
      openedAt: null,
      registeredParticipants,
      bidderCount: 0,
      participationRate: 0,
      highestBid: null,
      averageBid: null,
      medianBid: null,
      lowestBid: null,
      totalCommitted: 0,
      winnerName: null,
      winningBid: null,
    }
  }

  const amounts = bids.map(b => b.amount)
  const bidderCount = bids.length
  const participationRate =
    registeredParticipants > 0
      ? Math.round((bidderCount / registeredParticipants) * 100)
      : 0

  const highestBid = amounts.length > 0 ? Math.max(...amounts) : null
  const lowestBid = amounts.length > 0 ? Math.min(...amounts) : null
  const totalCommitted = amounts.reduce((s, v) => s + v, 0)
  const averageBid =
    amounts.length > 0 ? Math.round(totalCommitted / amounts.length) : null
  const medianBid = computeMedian(amounts)

  const roundStatus: 'waiting' | 'open' | 'closed' =
    round.status === 'open' ? 'open' : round.status === 'closed' ? 'closed' : 'waiting'

  return {
    roundId: round.id,
    status: roundStatus,
    traitTitle: round.trait?.title ?? null,
    traitDescription: round.trait?.description ?? null,
    openedAt: round.opened_at,
    registeredParticipants,
    bidderCount,
    participationRate,
    highestBid,
    averageBid,
    medianBid,
    lowestBid,
    totalCommitted,
    winnerName: round.winner?.display_name ?? null,
    winningBid: round.winning_bid_amount,
  }
}

/**
 * Derives cumulative game analytics from all participants and completed rounds.
 * `bidAmountsByRound` maps roundId → array of bid amounts for that round.
 */
export function computeCumulativeAnalytics(
  participants: Participant[],
  closedRounds: AuctionRound[],
  bidAmountsByRound: Record<string, number[]>,
): CumulativeGameAnalytics {
  const registeredCount = participants.length
  const totalStartingBudget = registeredCount * 1000
  const totalRemainingBudget = participants.reduce((s, p) => s + p.wallet_balance, 0)
  const totalSpent = totalStartingBudget - totalRemainingBudget
  const averageRemainingWallet =
    registeredCount > 0 ? Math.round(totalRemainingBudget / registeredCount) : 0

  const traitRankings: TraitRanking[] = closedRounds.map(round => {
    const amounts = bidAmountsByRound[round.id] ?? []
    const averageBid =
      amounts.length > 0
        ? Math.round(amounts.reduce((s, v) => s + v, 0) / amounts.length)
        : null

    return {
      traitId: round.trait_id,
      traitTitle: round.trait?.title ?? '—',
      roundId: round.id,
      winningBid: round.winning_bid_amount,
      bidderCount: amounts.length,
      averageBid,
      winnerName: round.winner?.display_name ?? null,
    }
  })

  // Sort by winning bid descending (most "valued" trait first)
  traitRankings.sort((a, b) => {
    if (b.winningBid === null && a.winningBid === null) return 0
    if (b.winningBid === null) return -1
    if (a.winningBid === null) return 1
    return b.winningBid - a.winningBid
  })

  return {
    totalStartingBudget,
    totalSpent,
    totalRemainingBudget,
    averageRemainingWallet,
    completedRounds: closedRounds.length,
    traitRankings,
  }
}

/**
 * Generates a Hebrew facilitation insight string based on current round metrics,
 * to prompt group reflection. Returns null when there are no bids yet.
 */
export function generateDiscussionInsight(analytics: CurrentRoundAnalytics): string | null {
  const { bidderCount, participationRate, highestBid, averageBid, totalCommitted, traitTitle } =
    analytics

  if (bidderCount === 0) return null

  const title = traitTitle ?? 'תכונה זו'

  // Very low participation (< 20%)
  if (participationRate < 20) {
    return `רק ${bidderCount} משתתפים הציעו הצעה על ${title}. שווה לשאול — מה מנע מאחרים להצטרף?`
  }

  // Low-to-medium participation (20–40%) with modest average bid
  if (participationRate < 40 && averageBid !== null && averageBid < 200) {
    return `ההשתתפות ב${title} היתה מוגבלת, וההצעות לא גבוהות במיוחד — ייתכן שהקבוצה אינה רואה בתכונה זו עדיפות גבוהה כרגע.`
  }

  // High participation but low average — wide but shallow interest
  if (participationRate >= 60 && averageBid !== null && averageBid < 200) {
    return `רבים מהמשתתפים בחרו להגיש הצעה על ${title}, אך ההצעות נמוכות — ייתכן שהתכונה נתפסת כחשובה, אך לא כדחופה מאוד.`
  }

  // Few bidders, high average — small committed group
  if (bidderCount <= 5 && averageBid !== null && highestBid !== null && averageBid > 300) {
    return `מספר קטן של משתתפים השקיעו מאוד ב${title} — קבוצה ממוקדת שרואה בתכונה זו ערך גבוה במיוחד עבורם.`
  }

  // Wide spread between highest and average bid
  if (
    highestBid !== null &&
    averageBid !== null &&
    highestBid > 0 &&
    highestBid / Math.max(averageBid, 1) >= 2.5
  ) {
    return `פערים ניכרים בין ההצעות על ${title} — יש בקבוצה תפיסות שונות מאוד לגבי הערך של תכונה זו.`
  }

  // Large total committed — group strongly values this trait
  if (totalCommitted >= 3000) {
    return `סה"כ ${totalCommitted.toLocaleString()} מטבעות הופנו ל${title} — הקבוצה מייחסת לתכונה זו ערך גבוה מאוד.`
  }

  // Healthy participation with moderate bids — balanced engagement
  if (participationRate >= 40) {
    return `${participationRate}% מהמשתתפים הגישו הצעה על ${title} — מעורבות טובה, ומעניין לבחון מה מניע את הפערים בין ההצעות.`
  }

  return null
}
