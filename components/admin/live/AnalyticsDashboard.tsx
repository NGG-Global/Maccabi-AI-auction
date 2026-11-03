'use client'

import { useRoundTimer } from '@/lib/hooks/useRoundTimer'
import { useAdminRealtimeAnalytics, type AllocationOverview } from '@/lib/hooks/useAdminRealtimeAnalytics'
import {
  generateSessionInsights,
  type RoundSummary,
  type CategoryAnalytics,
  type BudgetCheckpoint,
} from '@/lib/game/analytics'
import type { Room, GameMode } from '@/lib/types'
import type { Bid } from '@/lib/types'

interface Props {
  room: Room
  gameMode: GameMode
}

// ─── Metric card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: string | number
  subText?: string
  valueClassName?: string
}

function MetricCard({ label, value, subText, valueClassName = 'text-ivory' }: MetricCardProps) {
  return (
    <div className="rounded-[16px] border border-velvet-3 bg-velvet-2 p-4 flex flex-col gap-1 text-center">
      <p className="text-xs text-ivory-mute font-medium">{label}</p>
      <p className={`text-3xl num font-black leading-none mt-1 ${valueClassName}`}>
        {value}
      </p>
      {subText && <p className="text-xs text-ivory-dim mt-0.5">{subText}</p>}
    </div>
  )
}

// ─── Live bidder list ─────────────────────────────────────────────────────────

interface LiveBidderListProps {
  bids: Bid[]
  bidderCount: number
}

function LiveBidderList({ bids, bidderCount }: LiveBidderListProps) {
  if (bids.length === 0) {
    return (
      <div className="rounded-[16px] border border-velvet-3 bg-velvet-2 p-8 text-center flex flex-col items-center gap-3">
                <p className="text-ivory-dim text-base font-medium">ממתינים להצעות הראשונות</p>
      </div>
    )
  }

  const rankBadgeClass = (rank: number): string => {
    if (rank === 1) return 'bg-vermilion text-velvet-0'
    if (rank === 2) return 'bg-ivory text-velvet-0'
    if (rank === 3) return 'bg-bronze text-velvet-0'
    return 'bg-velvet-3 text-ivory'
  }

  return (
    <div className="rounded-[16px] border border-velvet-3 bg-velvet-2 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-velvet-3">
        <p className="text-xs text-ivory-dim font-medium">הצעות אחרונות</p>
        <div className="flex items-center gap-2">
          <span className="ev-live-dot !h-2 !w-2 !shadow-none" />
          <span className="text-xs text-ivory-dim">
            <span className="font-bold text-ivory">{bidderCount}</span> מציעים
          </span>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-velvet-3">
        {bids.map((bid, index) => {
          const rank = index + 1
          return (
            <div
              key={`${bid.participant_id}-${bid.amount}`}
              className="flex items-center gap-3 px-4 py-2.5 ev-drop"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${rankBadgeClass(rank)}`}
              >
                {rank}
              </span>
              <span className="flex-1 text-sm text-ivory-dim truncate">
                {bid.participant?.display_name ?? '—'}
              </span>
              <span
                className={`text-sm font-bold tabular-nums ${rank === 1 ? 'text-vermilion' : 'text-ivory-dim'}`}
              >
                {bid.amount.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Round card ───────────────────────────────────────────────────────────────

interface RoundCardProps {
  summary: RoundSummary
  prev?: RoundSummary
  showTrend?: boolean   // false in allocation mode, where rounds have no order
}

function RoundCard({ summary, prev, showTrend = true }: RoundCardProps) {
  const categoryBadgeClass = (cat: string | null): string => {
    switch (cat) {
      case 'שיפוט':
        return 'bg-velvet-3 text-ivory-dim'
      case 'יחסים':
        return 'bg-[rgba(255,179,138,.18)] text-ember'
      case 'מנהיגות':
        return 'bg-[rgba(255,90,54,.16)] text-[#ffd2c4]'
      case 'למידה':
        return 'bg-[rgba(185,138,94,.22)] text-bronze'
      default:
        return 'bg-velvet-3 text-ivory-dim'
    }
  }

  const trendArrow = (): { symbol: string; className: string } => {
    if (!prev) return { symbol: '→', className: 'text-ivory-mute' }
    const diff = summary.participationRate - prev.participationRate
    if (diff > 0) return { symbol: '↑', className: 'text-ivory' }
    if (diff < 0) return { symbol: '↓', className: 'text-error' }
    return { symbol: '→', className: 'text-ivory-mute' }
  }

  const trend = trendArrow()

  return (
    <div className="rounded-[16px] border border-velvet-3 bg-velvet-2 p-4 flex flex-col gap-2.5">
      {/* Top row: round number + category badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ivory-mute font-medium">#{summary.roundNumber}</span>
        {summary.category && (
          <span
            className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${categoryBadgeClass(summary.category)}`}
          >
            {summary.category}
          </span>
        )}
      </div>

      {/* Trait title */}
      <p className="text-sm font-bold text-ivory leading-tight">{summary.traitTitle}</p>

      {/* Winner row */}
      {summary.winnerName ? (
        <div className="flex items-center gap-2 bg-[rgba(255,90,54,.1)] rounded-lg px-3 py-1.5">
          
          <span className="text-xs font-bold text-vermilion flex-1 min-w-0">
            {summary.winnerCount > 1 && <span className="block text-[10px] text-ember">שוויון · זכייה משותפת</span>}
            <span className="block truncate">{summary.winnerName}</span>
          </span>
          {summary.winningBid !== null && (
            <span className="text-xs text-vermilion tabular-nums shrink-0">
              {summary.winningBid.toLocaleString()}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-velvet-1 rounded-lg px-3 py-1.5">
          <span className="text-xs text-ivory-mute">אין זוכה</span>
        </div>
      )}

      {/* Stats row: participation trend + average bid */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-ivory-dim">
          {showTrend && <><span className={`font-bold ${trend.className}`}>{trend.symbol}</span>{' '}</>}
          <span className="text-ivory font-bold">{summary.participationRate}%</span> השתתפות
        </span>
        {summary.averageBid !== null && (
          <span className="text-ivory-mute">
            ממוצע{' '}
            <span className="text-ivory-dim font-bold">{summary.averageBid.toLocaleString()}</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Category bars ────────────────────────────────────────────────────────────

interface CategoryBarsProps {
  breakdown: CategoryAnalytics[]
  /** winning: sum of winning bids (auction). allocated: every coin the group put in (allocation). */
  metric?: 'winning' | 'allocated'
}

function CategoryBars({ breakdown, metric = 'winning' }: CategoryBarsProps) {
  if (breakdown.length === 0) return null

  const valueOf = (c: CategoryAnalytics) => (metric === 'allocated' ? c.totalAllocated : c.totalWinningBid)
  const rows = metric === 'allocated' ? [...breakdown].sort((a, b) => valueOf(b) - valueOf(a)) : breakdown
  const maxTotal = Math.max(...rows.map(valueOf), 1)

  const barColorClass = (cat: string): string => {
    switch (cat) {
      case 'שיפוט':
        return 'bg-ivory-dim'
      case 'יחסים':
        return 'bg-ember'
      case 'מנהיגות':
        return 'bg-vermilion'
      case 'למידה':
        return 'bg-bronze'
      default:
        return 'bg-velvet-4'
    }
  }

  return (
    <div className="rounded-[16px] border border-velvet-3 bg-velvet-2 p-5 flex flex-col gap-4">
      <p className="text-sm font-bold text-ivory-dim">קטגוריות</p>
      <div className="flex flex-col gap-3">
        {rows.map(cat => {
          const barWidth = Math.round((valueOf(cat) / maxTotal) * 100)
          return (
            <div key={cat.category} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ivory-dim font-semibold">{cat.category}</span>
                <span className="text-ivory-dim tabular-nums">
                  {valueOf(cat).toLocaleString()} מטבעות
                </span>
              </div>
              <div className="h-2.5 bg-velvet-3 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColorClass(cat.category)}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="flex items-center gap-3 text-[10px] text-ivory-mute">
                <span>{cat.roundCount} {metric === 'allocated' ? 'פריטים' : 'סבבים'}</span>
                <span>השתתפות ממוצעת {cat.averageParticipation}%</span>
                {cat.averageWinningBid !== null && (
                  <span>ממוצע זכייה {cat.averageWinningBid.toLocaleString()}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Budget health ────────────────────────────────────────────────────────────

interface BudgetHealthProps {
  totalStarting: number
  totalSpent: number
  totalRemaining: number
  averageWallet: number
  completedRounds: number
  budgetTimeline: BudgetCheckpoint[]
}

function BudgetHealth({
  totalStarting,
  totalSpent,
  totalRemaining,
  averageWallet,
  budgetTimeline,
}: BudgetHealthProps) {
  const spendPercent =
    totalStarting > 0 ? Math.min(100, Math.round((totalSpent / totalStarting) * 100)) : 0

  const maxCumulative =
    budgetTimeline.length > 0 ? budgetTimeline[budgetTimeline.length - 1].cumulativeSpent : 1

  return (
    <div className="rounded-[16px] border border-velvet-3 bg-velvet-2 p-5 flex flex-col gap-4">
      <p className="text-sm font-bold text-ivory-dim">תקציב</p>

      {/* 2-col stat grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'נותר', value: totalRemaining.toLocaleString(), color: 'text-ivory' },
          { label: 'הושקע', value: totalSpent.toLocaleString(), color: 'text-error' },
          { label: 'יתרה ממוצעת', value: averageWallet.toLocaleString(), color: 'text-ivory-dim' },
          {
            label: 'תקציב התחלתי',
            value: totalStarting.toLocaleString(),
            color: 'text-ivory-dim',
          },
        ].map(stat => (
          <div key={stat.label} className="bg-velvet-1 rounded-xl p-3 text-center">
            <p className="text-[10px] text-ivory-mute mb-0.5">
              {stat.label}
            </p>
            <p className={`text-xl num font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Overall spend progress bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-ivory-dim">
          <span>ניצול תקציב</span>
          <span className="font-bold text-ivory">{spendPercent}%</span>
        </div>
        <div className="h-3 bg-velvet-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-vermilion rounded-full transition-all duration-700"
            style={{ width: `${spendPercent}%` }}
          />
        </div>
      </div>

      {/* Per-round budget timeline */}
      {budgetTimeline.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <p className="text-[10px] text-ivory-mute">לפי סבב</p>
          {budgetTimeline.map(checkpoint => {
            const barWidth = Math.round((checkpoint.cumulativeSpent / maxCumulative) * 100)
            return (
              <div key={checkpoint.roundNumber} className="flex items-center gap-2">
                <span className="text-[10px] text-ivory-mute w-4 text-left shrink-0">
                  {checkpoint.roundNumber}
                </span>
                <div className="flex-1 h-2 bg-velvet-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ember rounded-full transition-all duration-700"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="text-[10px] text-ivory-mute truncate shrink-0 max-w-[5rem]">
                  {checkpoint.traitTitle}
                </span>
                <span className="text-[10px] text-ivory-dim tabular-nums w-16 text-left shrink-0">
                  {checkpoint.cumulativeSpent.toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Allocation overview ──────────────────────────────────────────────────────

interface AllocationOverviewPanelProps {
  overview: AllocationOverview
  elapsed: string
}

/**
 * Allocation-mode replacement for the current-round section. While the
 * allocation is open it shows participation only — amounts stay hidden on
 * the projected screen until the facilitator closes it.
 */
function AllocationOverviewPanel({ overview, elapsed }: AllocationOverviewPanelProps) {
  const { status, registeredParticipants, allocatorCount, participationRate, totalAllocated } = overview
  const participationColor =
    participationRate >= 80 ? 'text-ivory' : participationRate >= 50 ? 'text-vermilion' : 'text-error'

  const heroBg =
    status === 'open'
      ? 'border border-velvet-3 bg-velvet-2'
      : status === 'closed'
        ? 'border border-[rgba(255,90,54,.4)] bg-velvet-2'
        : 'border border-velvet-3 bg-velvet-2'

  return (
    <>
      <div className={`rounded-[20px] p-6 ${heroBg}`}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border ${
            status === 'open'
              ? 'bg-[rgba(255,90,54,.16)] text-[#ffd2c4]'
              : status === 'closed'
                ? 'border border-velvet-4 text-ivory-mute'
                : 'bg-velvet-3 text-ivory-dim'
          }`}>
            {status === 'open' && <span className="ev-live-dot !h-2 !w-2 !shadow-none" />}
            {status === 'open' ? 'המכירה פתוחה' : status === 'closed' ? 'המכירה נסגרה' : 'ממתין'}
          </span>
          {status === 'open' && (
            <span className="text-vermilion font-black text-2xl tabular-nums num">{elapsed}</span>
          )}
        </div>
        <p className="font-display text-3xl font-black text-ivory">
          {status === 'waiting' ? 'ממתינים לפתיחת המכירה' : 'חלוקת תקציב · כל הפריטים יחד'}
        </p>
        {status === 'open' && (
          <p className="text-ivory-dim text-sm mt-1">הסכומים מוסתרים עד סגירת המכירה.</p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="משתתפים רשומים" value={registeredParticipants} />
        <MetricCard
          label="שמרו חלוקה"
          value={status === 'waiting' ? '—' : allocatorCount}
          subText={status === 'waiting' ? undefined : `${participationRate}%`}
          valueClassName={status === 'waiting' ? 'text-ivory-mute' : participationColor}
        />
        <MetricCard
          label="מטבעות שהוקצו"
          value={status === 'closed' ? totalAllocated.toLocaleString() : '—'}
          valueClassName={status === 'closed' ? 'text-vermilion' : 'text-ivory-mute'}
        />
        <MetricCard
          label="ממוצע למשתתף"
          value={status === 'closed' && allocatorCount > 0 ? Math.round(totalAllocated / allocatorCount).toLocaleString() : '—'}
          valueClassName={status === 'closed' ? 'text-ivory-dim' : 'text-ivory-mute'}
        />
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalyticsDashboard({ room, gameMode }: Props) {
  const isAllocation = gameMode === 'allocation'
  const {
    currentRoundAnalytics,
    allocationOverview,
    cumulativeAnalytics,
    currentBids,
    discussionInsight,
    connectionStatus,
    loading,
    error,
  } = useAdminRealtimeAnalytics(room.id, gameMode, room.starting_coins)

  const { elapsed } = useRoundTimer(
    isAllocation ? allocationOverview.openedAt : currentRoundAnalytics.openedAt,
    isAllocation ? allocationOverview.status === 'open' : currentRoundAnalytics.status === 'open',
    null,
  )

  // ── Loading — skeleton UI ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-velvet-1 overflow-y-auto" dir="rtl">
        <div className="flex flex-col gap-5 p-6 lg:p-8">
          {/* Hero skeleton */}
          <div className="skeleton rounded-[20px] h-40 w-full" />
          {/* Metrics skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="skeleton rounded-[16px] h-24" />
            ))}
          </div>
          {/* Two-column content skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="skeleton rounded-[16px] h-64" />
            <div className="skeleton rounded-[16px] h-64" />
          </div>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-velvet-1" dir="rtl">
        <div className="rounded-[20px] border border-velvet-3 bg-velvet-2 p-10 text-center max-w-md">
                    <p className="text-error text-xl font-bold mb-2">שגיאה בטעינת הנתונים</p>
          <p className="text-ivory-dim text-sm">{error}</p>
        </div>
      </div>
    )
  }

  // ── Destructure analytics ──────────────────────────────────────────────────

  const {
    status,
    traitTitle,
    traitDescription,
    bidderCount,
    registeredParticipants,
    participationRate,
    highestBid,
    averageBid,
    medianBid,
    winnerName,
    winningBid,
  } = currentRoundAnalytics

  const {
    totalStartingBudget,
    totalSpent,
    totalRemainingBudget,
    averageRemainingWallet,
    completedRounds,
    roundSummaries,
    categoryBreakdown,
    budgetTimeline,
  } = cumulativeAnalytics

  const participationColor =
    participationRate >= 50
      ? 'text-ivory'
      : participationRate >= 25
        ? 'text-vermilion'
        : 'text-error'

  const sessionInsights = completedRounds > 0 ? generateSessionInsights(cumulativeAnalytics, gameMode) : []

  // Hero card visual style based on round status
  const heroBg =
    status === 'open'
      ? 'border border-velvet-3 bg-velvet-2'
      : status === 'closed'
        ? 'border border-[rgba(255,90,54,.4)] bg-velvet-2'
        : 'border border-velvet-3 bg-velvet-2'

  return (
    <div className="flex-1 flex flex-col bg-velvet-1 overflow-y-auto" dir="rtl">

      {/* ── Connection warning bar — only when disconnected or error, not connecting ── */}
      {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
        <div
          className={`shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${
            connectionStatus === 'error'
              ? 'border-b border-[rgba(255,157,130,.4)] bg-[#2a1a1d] text-error'
              : 'border-b border-[rgba(255,179,138,.4)] bg-[#2a1a1d] text-ember'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-current ev-live-dot !h-2 !w-2 !shadow-none" />
          {connectionStatus === 'error'
            ? 'שגיאת חיבור. מנסים להתחבר מחדש…'
            : 'החיבור החי נותק זמנית. מנסים להתחבר מחדש…'}
        </div>
      )}

      <div className="flex-1 flex flex-col gap-5 p-6 lg:p-8">

        {/* ══════════════════════════════════════════════════════════════════════
            Section 1 — Current Round
        ══════════════════════════════════════════════════════════════════════ */}

        {isAllocation ? (
          <AllocationOverviewPanel overview={allocationOverview} elapsed={elapsed} />
        ) : (<>
        {/* Compact hero card */}
        <div className={`rounded-[20px] p-6 ${heroBg}`}>

          {status === 'waiting' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 bg-velvet-3 border border-velvet-3 rounded-full px-3 py-1 text-ivory-dim text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-velvet-4" />
                  ממתין
                </span>
              </div>
              <p className="font-display text-3xl font-black text-ivory">ממתינים לסבב הבא</p>
              <p className="text-ivory-dim text-sm">
                <span className="font-bold text-ivory text-base">{registeredParticipants}</span>{' '}
                משתתפים רשומים
              </p>
            </div>
          )}

          {status === 'open' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,90,54,.16)] px-3 py-1 text-[#ffd2c4] text-xs font-bold">
                  <span className="ev-live-dot !h-2 !w-2 !shadow-none" />
                  סבב פתוח
                </span>
                <span className="text-vermilion font-black text-2xl tabular-nums num">
                  {elapsed}
                </span>
              </div>
              <h2 className="font-display text-3xl font-black text-ivory leading-tight">{traitTitle}</h2>
              {traitDescription && (
                <p className="text-ivory-dim text-base leading-relaxed">{traitDescription}</p>
              )}
            </div>
          )}

          {status === 'closed' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-velvet-4 px-3 py-1 text-ivory-mute text-xs font-bold">
                  הסבב נסגר
                </span>
              </div>
              <h2 className="font-display text-3xl font-black text-ivory leading-tight">{traitTitle}</h2>
              {winnerName && winningBid !== null && (
                <p className="text-vermilion text-xl num font-black">
                  {winnerName} · {winningBid.toLocaleString()} מטבעות
                </p>
              )}
            </div>
          )}
        </div>

        {/* 4 metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="השתתפות"
            value={bidderCount > 0 ? `${participationRate}%` : '—'}
            subText={bidderCount > 0 ? `${bidderCount} / ${registeredParticipants}` : undefined}
            valueClassName={bidderCount > 0 ? participationColor : 'text-ivory-mute'}
          />
          <MetricCard
            label="הצעה גבוהה"
            value={highestBid !== null ? highestBid.toLocaleString() : '—'}
            valueClassName={highestBid !== null ? 'text-vermilion' : 'text-ivory-mute'}
          />
          <MetricCard
            label="ממוצע הצעות"
            value={averageBid !== null ? averageBid.toLocaleString() : '—'}
            valueClassName={averageBid !== null ? 'text-ivory-dim' : 'text-ivory-mute'}
          />
          <MetricCard
            label="חציון"
            value={medianBid !== null ? medianBid.toLocaleString() : '—'}
            valueClassName={medianBid !== null ? 'text-ivory-dim' : 'text-ivory-mute'}
          />
        </div>

        {/* Two-column live section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Left — live bids / winner card / waiting placeholder */}
          <div className="flex flex-col gap-3">
            {status === 'open' && (
              <LiveBidderList bids={currentBids} bidderCount={bidderCount} />
            )}

            {status === 'closed' && winnerName && (
              <div className="rounded-[16px] p-6 border-2 border-[rgba(255,90,54,.5)] bg-velvet-2 flex flex-col gap-2">
                <p className="text-vermilion text-xs font-bold uppercase tracking-widest">
                  הזוכה
                </p>
                <p className="font-display text-4xl font-black text-ivory leading-tight">{winnerName}</p>
                {winningBid !== null && (
                  <p className="text-vermilion text-3xl num font-black">
                    {winningBid.toLocaleString()}
                  </p>
                )}
                <p className="text-ivory-dim text-sm mt-1">
                  מתוך <span className="font-bold text-ivory">{bidderCount}</span> מציעים
                </p>
                {winningBid !== null && currentBids.filter(b => b.amount === winningBid).length > 1 && (
                  <p className="text-ember text-sm">שוויון: זוכה מי שהציע את הסכום ראשון</p>
                )}
              </div>
            )}

            {status === 'closed' && !winnerName && (
              <div className="rounded-[16px] border border-velvet-3 bg-velvet-2 p-8 flex flex-col items-center justify-center gap-3 text-center">
                                <p className="text-ivory-dim text-lg font-bold">הסבב נסגר ללא הצעות</p>
                <p className="text-ivory-mute text-sm">לא הוגשו הצעות בסבב זה</p>
              </div>
            )}

            {status === 'waiting' && (
              <div className="rounded-[16px] border border-velvet-3 bg-velvet-2 p-8 flex flex-col items-center justify-center gap-3 text-center">
                                <p className="text-ivory-dim text-base font-medium">ממתינים לפתיחת הסבב</p>
              </div>
            )}
          </div>

          {/* Right — discussion insight or cumulative budget mini-summary */}
          <div className="flex flex-col gap-3">
            {discussionInsight ? (
              <div
                className={`rounded-[16px] border border-velvet-3 bg-velvet-2 p-6 flex flex-col gap-2 border ${
                  status === 'open'
                    ? 'border-velvet-4'
                    : 'border-[rgba(255,90,54,.4)]'
                }`}
              >
                <p
                  className={`text-xs font-bold ${
                    status === 'open' ? 'text-ivory-dim' : 'text-vermilion'
                  }`}
                >
                  נקודה לדיון
                </p>
                <p className="text-base font-medium text-ivory-dim leading-relaxed">
                  {discussionInsight}
                </p>
              </div>
            ) : (
              <div className="rounded-[16px] border border-velvet-3 bg-velvet-2 p-5 flex flex-col gap-3">
                <p className="text-xs text-ivory-dim font-medium">
                  תקציב קבוצתי
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: 'נותר לקבוצה',
                      value: totalRemainingBudget.toLocaleString(),
                      color: 'text-ivory',
                    },
                    {
                      label: 'מטבעות שהושקעו',
                      value: totalSpent.toLocaleString(),
                      color: 'text-error',
                    },
                    {
                      label: 'יתרה ממוצעת',
                      value: averageRemainingWallet.toLocaleString(),
                      color: 'text-ivory-dim',
                    },
                    {
                      label: 'תקציב התחלתי',
                      value: totalStartingBudget.toLocaleString(),
                      color: 'text-ivory-dim',
                    },
                  ].map(stat => (
                    <div key={stat.label} className="bg-velvet-1 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-ivory-mute mb-0.5">
                        {stat.label}
                      </p>
                      <p className={`text-xl num font-black ${stat.color}`}>
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        </>)}

        {/* ══════════════════════════════════════════════════════════════════════
            Section 2 — Completed Rounds
        ══════════════════════════════════════════════════════════════════════ */}
        {completedRounds > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-xl font-bold text-ivory">{isAllocation ? 'תוצאות לפי פריט' : 'סבבים שהסתיימו'}</h3>
              <span className="bg-velvet-3 text-ivory text-xs font-bold rounded-full px-2.5 py-0.5">
                {completedRounds}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {roundSummaries.map((summary, i) => (
                <RoundCard
                  key={summary.roundId}
                  summary={summary}
                  prev={i > 0 ? roundSummaries[i - 1] : undefined}
                  showTrend={!isAllocation}
                />
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            Section 3 — Analysis: categories + budget (only after 2+ rounds)
        ══════════════════════════════════════════════════════════════════════ */}
        {completedRounds >= 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CategoryBars breakdown={categoryBreakdown} metric={isAllocation ? 'allocated' : 'winning'} />
            <BudgetHealth
              totalStarting={totalStartingBudget}
              totalSpent={totalSpent}
              totalRemaining={totalRemainingBudget}
              averageWallet={averageRemainingWallet}
              completedRounds={completedRounds}
              budgetTimeline={isAllocation ? [] : budgetTimeline}
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            Section 4 — Session Insights (only if insights exist)
        ══════════════════════════════════════════════════════════════════════ */}
        {sessionInsights.length > 0 && (
          <div className="rounded-[16px] border border-velvet-3 bg-velvet-2 p-6 flex flex-col gap-4">
            <p className="text-sm font-bold text-ivory-dim">
              תובנות מהסשן
            </p>
            <ul className="flex flex-col gap-2.5 list-none">
              {sessionInsights.map((insight, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-vermilion shrink-0" />
                  <span className="text-ivory-dim text-sm leading-relaxed">{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  )
}
