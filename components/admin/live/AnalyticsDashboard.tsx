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

function MetricCard({ label, value, subText, valueClassName = 'text-ink' }: MetricCardProps) {
  return (
    <div className="rounded-[18px] border-[2.5px] border-ink bg-card shadow-piece-sm p-4 flex flex-col gap-1 text-center">
      <p className="text-xs text-ink-3 font-medium">{label}</p>
      <p className={`text-3xl num font-bold leading-none mt-1 ${valueClassName}`}>
        {value}
      </p>
      {subText && <p className="text-xs text-ink-2 mt-0.5">{subText}</p>}
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
      <div className="rounded-[18px] border-[2.5px] border-ink bg-card shadow-piece-sm p-8 text-center flex flex-col items-center gap-3">
                <p className="text-ink-2 text-base font-medium">ממתינים להצעות הראשונות</p>
      </div>
    )
  }

  const rankBadgeClass = (rank: number): string => {
    if (rank === 1) return 'bg-sun text-ink'
    if (rank === 2) return 'bg-sky text-ink'
    if (rank === 3) return 'bg-lilac text-ink'
    return 'bg-[#eef3f0] text-ink'
  }

  return (
    <div className="rounded-[18px] border-[2.5px] border-ink bg-card shadow-piece-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-mint-line">
        <p className="text-xs text-ink-2 font-medium">הצעות אחרונות</p>
        <div className="flex items-center gap-2">
          <span className="gm-live-dot !h-2 !w-2 !bg-leaf-dot !shadow-none" />
          <span className="text-xs text-ink-2">
            <span className="font-bold text-ink">{bidderCount}</span> מציעים
          </span>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-mint-line">
        {bids.map((bid, index) => {
          const rank = index + 1
          return (
            <div
              key={`${bid.participant_id}-${bid.amount}`}
              className="flex items-center gap-3 px-4 py-2.5 gm-drop"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${rankBadgeClass(rank)}`}
              >
                {rank}
              </span>
              <span className="flex-1 text-sm text-ink-2 truncate">
                {bid.participant?.display_name ?? '—'}
              </span>
              <span
                className={`text-sm font-bold tabular-nums ${rank === 1 ? 'text-tomato-text' : 'text-ink-2'}`}
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

function TrendIcon({ dir, label, className }: { dir: 'up' | 'down' | 'flat'; label: string; className: string }) {
  const path = dir === 'up' ? 'M8 13V3M4 7l4-4 4 4' : dir === 'down' ? 'M8 3v10M4 9l4 4 4-4' : 'M13 8H3M7 4 3 8l4 4'
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" role="img" aria-label={label} className={`inline-block align-[-2px] ${className}`}>
      <path d={path} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
        return 'bg-[#eef3f0] text-ink-2'
      case 'יחסים':
        return 'bg-peach text-ink'
      case 'מנהיגות':
        return 'bg-leaf text-ink'
      case 'למידה':
        return 'bg-lilac text-ink'
      default:
        return 'bg-[#eef3f0] text-ink-2'
    }
  }

  // Drawn as icons: Fredoka has no arrow glyphs, and a fallback font would break the single typeface.
  const trendArrow = (): { dir: 'up' | 'down' | 'flat'; label: string; className: string } => {
    if (!prev) return { dir: 'flat', label: 'ללא שינוי', className: 'text-ink-3' }
    const diff = summary.participationRate - prev.participationRate
    if (diff > 0) return { dir: 'up', label: 'עלייה', className: 'text-ink' }
    if (diff < 0) return { dir: 'down', label: 'ירידה', className: 'text-error' }
    return { dir: 'flat', label: 'ללא שינוי', className: 'text-ink-3' }
  }

  const trend = trendArrow()

  return (
    <div className="rounded-[18px] border-[2.5px] border-ink bg-card shadow-piece-sm p-4 flex flex-col gap-2.5">
      {/* Top row: round number + category badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-3 font-medium">#{summary.roundNumber}</span>
        {summary.category && (
          <span
            className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${categoryBadgeClass(summary.category)}`}
          >
            {summary.category}
          </span>
        )}
      </div>

      {/* Trait title */}
      <p className="text-sm font-bold text-ink leading-tight">{summary.traitTitle}</p>

      {/* Winner row */}
      {summary.winnerName ? (
        <div className="flex items-center gap-2 bg-sun-tint rounded-lg px-3 py-1.5">
          
          <span className="text-xs font-bold text-tomato-text flex-1 min-w-0">
            {summary.winnerCount > 1 && <span className="block text-[10px] text-sun-text">שוויון · זכייה משותפת</span>}
            <span className="block truncate">{summary.winnerName}</span>
          </span>
          {summary.winningBid !== null && (
            <span className="text-xs text-tomato-text tabular-nums shrink-0">
              {summary.winningBid.toLocaleString()}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-zebra rounded-lg px-3 py-1.5">
          <span className="text-xs text-ink-3">אין זוכה</span>
        </div>
      )}

      {/* Stats row: participation trend + average bid */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-2">
          {showTrend && <><TrendIcon dir={trend.dir} label={trend.label} className={trend.className} />{' '}</>}
          <span className="text-ink font-bold">{summary.participationRate}%</span> השתתפות
        </span>
        {summary.averageBid !== null && (
          <span className="text-ink-3">
            ממוצע{' '}
            <span className="text-ink-2 font-bold">{summary.averageBid.toLocaleString()}</span>
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
        return 'bg-sky'
      case 'יחסים':
        return 'bg-peach'
      case 'מנהיגות':
        return 'bg-sun'
      case 'למידה':
        return 'bg-lilac'
      default:
        return 'bg-muted-outline'
    }
  }

  return (
    <div className="rounded-[18px] border-[2.5px] border-ink bg-card shadow-piece-sm p-5 flex flex-col gap-4">
      <p className="text-sm font-bold text-ink-2">קטגוריות</p>
      <div className="flex flex-col gap-3">
        {rows.map(cat => {
          const barWidth = Math.round((valueOf(cat) / maxTotal) * 100)
          return (
            <div key={cat.category} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-2 font-semibold">{cat.category}</span>
                <span className="text-ink-2 tabular-nums">
                  {valueOf(cat).toLocaleString()} מטבעות
                </span>
              </div>
              <div className="h-2.5 bg-meter rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColorClass(cat.category)}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="flex items-center gap-3 text-[10px] text-ink-3">
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
    <div className="rounded-[18px] border-[2.5px] border-ink bg-card shadow-piece-sm p-5 flex flex-col gap-4">
      <p className="text-sm font-bold text-ink-2">תקציב</p>

      {/* 2-col stat grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'נותר', value: totalRemaining.toLocaleString(), color: 'text-ink' },
          { label: 'הושקע', value: totalSpent.toLocaleString(), color: 'text-error' },
          { label: 'יתרה ממוצעת', value: averageWallet.toLocaleString(), color: 'text-ink-2' },
          {
            label: 'תקציב התחלתי',
            value: totalStarting.toLocaleString(),
            color: 'text-ink-2',
          },
        ].map(stat => (
          <div key={stat.label} className="bg-zebra rounded-xl p-3 text-center">
            <p className="text-[10px] text-ink-3 mb-0.5">
              {stat.label}
            </p>
            <p className={`text-xl num font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Overall spend progress bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-ink-2">
          <span>ניצול תקציב</span>
          <span className="font-bold text-ink">{spendPercent}%</span>
        </div>
        <div className="h-3 bg-meter rounded-full overflow-hidden">
          <div
            className="h-full bg-tomato rounded-full transition-all duration-700"
            style={{ width: `${spendPercent}%` }}
          />
        </div>
      </div>

      {/* Per-round budget timeline */}
      {budgetTimeline.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <p className="text-[10px] text-ink-3">לפי סבב</p>
          {budgetTimeline.map(checkpoint => {
            const barWidth = Math.round((checkpoint.cumulativeSpent / maxCumulative) * 100)
            return (
              <div key={checkpoint.roundNumber} className="flex items-center gap-2">
                <span className="text-[10px] text-ink-3 w-4 text-left shrink-0">
                  {checkpoint.roundNumber}
                </span>
                <div className="flex-1 h-2 bg-meter rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sun rounded-full transition-all duration-700"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="text-[10px] text-ink-3 truncate shrink-0 max-w-[5rem]">
                  {checkpoint.traitTitle}
                </span>
                <span className="text-[10px] text-ink-2 tabular-nums w-16 text-left shrink-0">
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
    participationRate >= 80 ? 'text-ink' : participationRate >= 50 ? 'text-tomato-text' : 'text-error'

  const heroBg =
    status === 'open'
      ? 'border-[2.5px] border-ink bg-card'
      : status === 'closed'
        ? 'border-[2.5px] border-ink bg-sun-tint'
        : 'border-[2.5px] border-ink bg-card'

  return (
    <>
      <div className={`rounded-[20px] p-6 ${heroBg}`}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border ${
            status === 'open'
              ? 'bg-leaf text-ink'
              : status === 'closed'
                ? 'border-2 border-muted-outline text-ink-3'
                : 'bg-[#eef3f0] text-ink-2'
          }`}>
            {status === 'open' && <span className="gm-live-dot !h-2 !w-2 !bg-leaf-dot !shadow-none" />}
            {status === 'open' ? 'המכירה פתוחה' : status === 'closed' ? 'המכירה נסגרה' : 'ממתין'}
          </span>
          {status === 'open' && (
            <span className="text-tomato-text font-bold text-2xl tabular-nums num">{elapsed}</span>
          )}
        </div>
        <p className="text-3xl font-bold text-ink">
          {status === 'waiting' ? 'ממתינים לפתיחת המכירה' : 'חלוקת תקציב · כל הפריטים יחד'}
        </p>
        {status === 'open' && (
          <p className="text-ink-2 text-sm mt-1">הסכומים מוסתרים עד סגירת המכירה.</p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="משתתפים רשומים" value={registeredParticipants} />
        <MetricCard
          label="שמרו חלוקה"
          value={status === 'waiting' ? '—' : allocatorCount}
          subText={status === 'waiting' ? undefined : `${participationRate}%`}
          valueClassName={status === 'waiting' ? 'text-ink-3' : participationColor}
        />
        <MetricCard
          label="מטבעות שהוקצו"
          value={status === 'closed' ? totalAllocated.toLocaleString() : '—'}
          valueClassName={status === 'closed' ? 'text-tomato-text' : 'text-ink-3'}
        />
        <MetricCard
          label="ממוצע למשתתף"
          value={status === 'closed' && allocatorCount > 0 ? Math.round(totalAllocated / allocatorCount).toLocaleString() : '—'}
          valueClassName={status === 'closed' ? 'text-ink-2' : 'text-ink-3'}
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
      <div className="flex-1 flex flex-col bg-zebra overflow-y-auto" dir="rtl">
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
      <div className="flex-1 flex items-center justify-center min-h-screen bg-zebra" dir="rtl">
        <div className="rounded-[24px] border-[2.5px] border-ink bg-card shadow-piece p-10 text-center max-w-md">
                    <p className="text-error text-xl font-bold mb-2">שגיאה בטעינת הנתונים</p>
          <p className="text-ink-2 text-sm">{error}</p>
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
      ? 'text-ink'
      : participationRate >= 25
        ? 'text-tomato-text'
        : 'text-error'

  const sessionInsights = completedRounds > 0 ? generateSessionInsights(cumulativeAnalytics, gameMode) : []

  // Hero card visual style based on round status
  const heroBg =
    status === 'open'
      ? 'border-[2.5px] border-ink bg-card'
      : status === 'closed'
        ? 'border-[2.5px] border-ink bg-sun-tint'
        : 'border-[2.5px] border-ink bg-card'

  return (
    <div className="flex-1 flex flex-col bg-zebra overflow-y-auto" dir="rtl">

      {/* ── Connection warning bar — only when disconnected or error, not connecting ── */}
      {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
        <div
          className={`shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${
            connectionStatus === 'error'
              ? 'border-b-2 border-error bg-error-tint text-error'
              : 'border-b-2 border-ink bg-sun-tint text-sun-text'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-current gm-live-dot !h-2 !w-2 !bg-leaf-dot !shadow-none" />
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
                <span className="inline-flex items-center gap-2 bg-meter border border-mint-line rounded-full px-3 py-1 text-ink-2 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-muted-outline" />
                  ממתין
                </span>
              </div>
              <p className="text-3xl font-bold text-ink">ממתינים לסבב הבא</p>
              <p className="text-ink-2 text-sm">
                <span className="font-bold text-ink text-base">{registeredParticipants}</span>{' '}
                משתתפים רשומים
              </p>
            </div>
          )}

          {status === 'open' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-leaf px-3 py-1 text-ink text-xs font-bold">
                  <span className="gm-live-dot !h-2 !w-2 !bg-leaf-dot !shadow-none" />
                  סבב פתוח
                </span>
                <span className="text-tomato-text font-bold text-2xl tabular-nums num">
                  {elapsed}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-ink leading-tight">{traitTitle}</h2>
              {traitDescription && (
                <p className="text-ink-2 text-base leading-relaxed">{traitDescription}</p>
              )}
            </div>
          )}

          {status === 'closed' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-muted-outline bg-card px-3 py-1 text-ink-3 text-xs font-bold">
                  הסבב נסגר
                </span>
              </div>
              <h2 className="text-3xl font-bold text-ink leading-tight">{traitTitle}</h2>
              {winnerName && winningBid !== null && (
                <p className="text-tomato-text text-xl num font-bold">
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
            valueClassName={bidderCount > 0 ? participationColor : 'text-ink-3'}
          />
          <MetricCard
            label="הצעה גבוהה"
            value={highestBid !== null ? highestBid.toLocaleString() : '—'}
            valueClassName={highestBid !== null ? 'text-tomato-text' : 'text-ink-3'}
          />
          <MetricCard
            label="ממוצע הצעות"
            value={averageBid !== null ? averageBid.toLocaleString() : '—'}
            valueClassName={averageBid !== null ? 'text-ink-2' : 'text-ink-3'}
          />
          <MetricCard
            label="חציון"
            value={medianBid !== null ? medianBid.toLocaleString() : '—'}
            valueClassName={medianBid !== null ? 'text-ink-2' : 'text-ink-3'}
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
              <div className="rounded-[16px] p-6 border-[2.5px] border-ink bg-sun-tint shadow-piece flex flex-col gap-2">
                <p className="text-tomato-text text-xs font-bold uppercase tracking-widest">
                  הזוכה
                </p>
                <p className="text-4xl font-bold text-ink leading-tight">{winnerName}</p>
                {winningBid !== null && (
                  <p className="text-tomato-text text-3xl num font-bold">
                    {winningBid.toLocaleString()}
                  </p>
                )}
                <p className="text-ink-2 text-sm mt-1">
                  מתוך <span className="font-bold text-ink">{bidderCount}</span> מציעים
                </p>
                {winningBid !== null && currentBids.filter(b => b.amount === winningBid).length > 1 && (
                  <p className="text-sun-text text-sm">שוויון: זוכה מי שהציע את הסכום ראשון</p>
                )}
              </div>
            )}

            {status === 'closed' && !winnerName && (
              <div className="rounded-[18px] border-[2.5px] border-ink bg-card shadow-piece-sm p-8 flex flex-col items-center justify-center gap-3 text-center">
                                <p className="text-ink-2 text-lg font-bold">הסבב נסגר ללא הצעות</p>
                <p className="text-ink-3 text-sm">לא הוגשו הצעות בסבב זה</p>
              </div>
            )}

            {status === 'waiting' && (
              <div className="rounded-[18px] border-[2.5px] border-ink bg-card shadow-piece-sm p-8 flex flex-col items-center justify-center gap-3 text-center">
                                <p className="text-ink-2 text-base font-medium">ממתינים לפתיחת הסבב</p>
              </div>
            )}
          </div>

          {/* Right — discussion insight or cumulative budget mini-summary */}
          <div className="flex flex-col gap-3">
            {discussionInsight ? (
              <div
                className={`rounded-[18px] border-[2.5px] border-ink bg-card shadow-piece-sm p-6 flex flex-col gap-2 border ${
                  status === 'open'
                    ? 'border-ink'
                    : 'border-ink'
                }`}
              >
                <p
                  className={`text-xs font-bold ${
                    status === 'open' ? 'text-ink-2' : 'text-tomato-text'
                  }`}
                >
                  נקודה לדיון
                </p>
                <p className="text-base font-medium text-ink-2 leading-relaxed">
                  {discussionInsight}
                </p>
              </div>
            ) : (
              <div className="rounded-[18px] border-[2.5px] border-ink bg-card shadow-piece-sm p-5 flex flex-col gap-3">
                <p className="text-xs text-ink-2 font-medium">
                  תקציב קבוצתי
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: 'נותר לקבוצה',
                      value: totalRemainingBudget.toLocaleString(),
                      color: 'text-ink',
                    },
                    {
                      label: 'מטבעות שהושקעו',
                      value: totalSpent.toLocaleString(),
                      color: 'text-error',
                    },
                    {
                      label: 'יתרה ממוצעת',
                      value: averageRemainingWallet.toLocaleString(),
                      color: 'text-ink-2',
                    },
                    {
                      label: 'תקציב התחלתי',
                      value: totalStartingBudget.toLocaleString(),
                      color: 'text-ink-2',
                    },
                  ].map(stat => (
                    <div key={stat.label} className="bg-zebra rounded-xl p-3 text-center">
                      <p className="text-[10px] text-ink-3 mb-0.5">
                        {stat.label}
                      </p>
                      <p className={`text-xl num font-bold ${stat.color}`}>
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
              <h3 className="text-xl font-bold text-ink">{isAllocation ? 'תוצאות לפי פריט' : 'סבבים שהסתיימו'}</h3>
              <span className="bg-[#eef3f0] text-ink text-xs font-bold rounded-full px-2.5 py-0.5">
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
          <div className="rounded-[18px] border-[2.5px] border-ink bg-card shadow-piece-sm p-6 flex flex-col gap-4">
            <p className="text-sm font-bold text-ink-2">
              תובנות מהסשן
            </p>
            <ul className="flex flex-col gap-2.5 list-none">
              {sessionInsights.map((insight, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-tomato shrink-0" />
                  <span className="text-ink-2 text-sm leading-relaxed">{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  )
}
