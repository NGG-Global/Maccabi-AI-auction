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

export interface RoundSummary {
  roundId: string
  roundNumber: number     // 1-based chronological index
  traitId: string
  traitTitle: string
  category: string | null
  winnerName: string | null
  winningBid: number | null
  bidderCount: number
  participationRate: number   // 0–100
  averageBid: number | null
  medianBid: number | null
  highestBid: number | null
  lowestBid: number | null
  totalBid: number
}

export interface CategoryAnalytics {
  category: string
  roundCount: number
  totalWinningBid: number
  averageWinningBid: number | null
  averageParticipation: number  // 0–100
}

export interface BudgetCheckpoint {
  roundNumber: number
  traitTitle: string
  winningBid: number
  cumulativeSpent: number
  spendPercent: number   // 0–100
}

export interface CumulativeGameAnalytics {
  totalStartingBudget: number         // registeredCount * 1000
  totalSpent: number                  // totalStartingBudget - sum(wallet_balance)
  totalRemainingBudget: number        // sum(wallet_balance)
  averageRemainingWallet: number
  completedRounds: number
  traitRankings: TraitRanking[]       // sorted by winningBid desc
  roundSummaries: RoundSummary[]
  categoryBreakdown: CategoryAnalytics[]
  budgetTimeline: BudgetCheckpoint[]
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

  const roundSummaries = computeRoundSummaries(closedRounds, bidAmountsByRound, registeredCount)
  const categoryBreakdown = computeCategoryBreakdown(roundSummaries)
  const budgetTimeline = computeBudgetTimeline(roundSummaries, totalStartingBudget)

  return {
    totalStartingBudget,
    totalSpent,
    totalRemainingBudget,
    averageRemainingWallet,
    completedRounds: closedRounds.length,
    traitRankings,
    roundSummaries,
    categoryBreakdown,
    budgetTimeline,
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

// ─── Round-level summary ──────────────────────────────────────────────────────

/**
 * Maps each closed round (in chronological array order) to a RoundSummary.
 * `bidAmountsByRound` maps roundId → array of bid amounts.
 * `registeredCount` is used to compute participationRate.
 */
export function computeRoundSummaries(
  closedRounds: AuctionRound[],
  bidAmountsByRound: Record<string, number[]>,
  registeredCount: number,
): RoundSummary[] {
  return closedRounds.map((round, index) => {
    const amounts = bidAmountsByRound[round.id] ?? []
    const bidderCount = amounts.length
    const totalBid = amounts.reduce((s, v) => s + v, 0)
    const averageBid = bidderCount > 0 ? Math.round(totalBid / bidderCount) : null
    const medianBid = computeMedian(amounts)
    const highestBid = bidderCount > 0 ? Math.max(...amounts) : null
    const lowestBid = bidderCount > 0 ? Math.min(...amounts) : null
    const participationRate =
      registeredCount > 0 ? Math.round((bidderCount / registeredCount) * 100) : 0

    return {
      roundId: round.id,
      roundNumber: index + 1,
      traitId: round.trait_id,
      traitTitle: round.trait?.title ?? '—',
      category: round.trait?.category ?? null,
      winnerName: round.winner?.display_name ?? null,
      winningBid: round.winning_bid_amount,
      bidderCount,
      participationRate,
      averageBid,
      medianBid,
      highestBid,
      lowestBid,
      totalBid,
    }
  })
}

// ─── Category breakdown ───────────────────────────────────────────────────────

/**
 * Groups RoundSummary records by category (defaulting to 'אחר' when null).
 * Returns one CategoryAnalytics per group, sorted descending by totalWinningBid.
 */
export function computeCategoryBreakdown(roundSummaries: RoundSummary[]): CategoryAnalytics[] {
  const groups = new Map<string, RoundSummary[]>()

  for (const summary of roundSummaries) {
    const key = summary.category ?? 'אחר'
    const existing = groups.get(key)
    if (existing) {
      existing.push(summary)
    } else {
      groups.set(key, [summary])
    }
  }

  const result: CategoryAnalytics[] = []

  for (const [category, summaries] of groups) {
    const roundCount = summaries.length
    const winningBids = summaries
      .map(s => s.winningBid)
      .filter((b): b is number => b !== null)
    const totalWinningBid = winningBids.reduce((s, v) => s + v, 0)
    const averageWinningBid =
      winningBids.length > 0 ? Math.round(totalWinningBid / winningBids.length) : null
    const averageParticipation =
      roundCount > 0
        ? Math.round(summaries.reduce((s, r) => s + r.participationRate, 0) / roundCount)
        : 0

    result.push({
      category,
      roundCount,
      totalWinningBid,
      averageWinningBid,
      averageParticipation,
    })
  }

  result.sort((a, b) => b.totalWinningBid - a.totalWinningBid)

  return result
}

// ─── Budget timeline ──────────────────────────────────────────────────────────

/**
 * Accumulates winning bids round by round, producing a spending checkpoint
 * for each round. spendPercent is capped at 100.
 * `totalStartingBudget` is the group's combined starting coins.
 */
export function computeBudgetTimeline(
  roundSummaries: RoundSummary[],
  totalStartingBudget: number,
): BudgetCheckpoint[] {
  let cumulativeSpent = 0

  return roundSummaries.map(summary => {
    const winningBid = summary.winningBid ?? 0
    cumulativeSpent += winningBid
    const spendPercent =
      totalStartingBudget > 0
        ? Math.min(100, Math.round((cumulativeSpent / totalStartingBudget) * 100))
        : 0

    return {
      roundNumber: summary.roundNumber,
      traitTitle: summary.traitTitle,
      winningBid,
      cumulativeSpent,
      spendPercent,
    }
  })
}

// ─── Session-level Hebrew insights ───────────────────────────────────────────

/**
 * Generates an array of Hebrew insight strings suitable for post-session
 * facilitation or a summary screen. Returns an empty array when no rounds
 * have been completed yet.
 */
export function generateSessionInsights(analytics: CumulativeGameAnalytics): string[] {
  const {
    traitRankings,
    roundSummaries,
    categoryBreakdown,
    completedRounds,
    totalStartingBudget,
    totalSpent,
  } = analytics

  if (roundSummaries.length === 0) return []

  const insights: string[] = []

  // (a) Most valued trait — highest winning bid
  const topTrait = traitRankings[0]
  if (topTrait && topTrait.winningBid !== null) {
    insights.push(
      `התכונה המוערכת ביותר היא "${topTrait.traitTitle}" — זכייה בהצעה של ${topTrait.winningBid.toLocaleString()} מטבעות.`,
    )
  }

  // (b) Round with highest participation
  const mostParticipated = roundSummaries.reduce(
    (best, r) => (r.participationRate > best.participationRate ? r : best),
    roundSummaries[0],
  )
  insights.push(
    `הסבב עם ההשתתפות הגבוהה ביותר היה "${mostParticipated.traitTitle}" — ${mostParticipated.participationRate}% מהמשתתפים הגישו הצעה.`,
  )

  // (c) Engagement trend — only when at least 4 rounds completed
  if (completedRounds >= 4) {
    const half = Math.floor(roundSummaries.length / 2)
    const firstHalf = roundSummaries.slice(0, half)
    const secondHalf = roundSummaries.slice(roundSummaries.length - half)
    const avgFirst =
      firstHalf.reduce((s, r) => s + r.participationRate, 0) / firstHalf.length
    const avgSecond =
      secondHalf.reduce((s, r) => s + r.participationRate, 0) / secondHalf.length
    const diff = avgSecond - avgFirst

    if (diff > 5) {
      insights.push(
        `מגמת מעורבות עולה — ההשתתפות גדלה בממוצע ב-${Math.round(diff)}% בין המחצית הראשונה למחצית השנייה של המשחק.`,
      )
    } else if (diff < -5) {
      insights.push(
        `מגמת מעורבות יורדת — ההשתתפות ירדה בממוצע ב-${Math.round(Math.abs(diff))}% בין המחצית הראשונה למחצית השנייה של המשחק.`,
      )
    } else {
      insights.push(
        `המעורבות נשמרה יציבה לאורך המשחק — ממוצע השתתפות דומה בין המחצית הראשונה לשנייה.`,
      )
    }
  }

  // (d) Top category by total winning bid
  const topCategory = categoryBreakdown[0]
  if (topCategory) {
    insights.push(
      `הקטגוריה עם ההשקעה הגבוהה ביותר היא "${topCategory.category}" — סה"כ ${topCategory.totalWinningBid.toLocaleString()} מטבעות הושקעו ב-${topCategory.roundCount} סבבים.`,
    )
  }

  // (e) Budget usage percent
  const budgetPercent =
    totalStartingBudget > 0
      ? Math.min(100, Math.round((totalSpent / totalStartingBudget) * 100))
      : 0
  insights.push(
    `בסך הכל הוצאה הקבוצה ${budgetPercent}% מהתקציב המשותף — ${totalSpent.toLocaleString()} מתוך ${totalStartingBudget.toLocaleString()} מטבעות.`,
  )

  return insights
}
