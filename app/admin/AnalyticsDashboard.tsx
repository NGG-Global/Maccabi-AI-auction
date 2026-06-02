'use client'

import { useEffect, useState } from 'react'
import { useAdminRealtimeAnalytics } from '@/lib/hooks/useAdminRealtimeAnalytics'
import {
  generateSessionInsights,
  type RoundSummary,
  type CategoryAnalytics,
  type BudgetCheckpoint,
} from '@/lib/game/analytics'
import type { Event } from '@/lib/types'
import type { Bid } from '@/lib/types'

interface Props {
  event: Event
}

// ─── Elapsed timer ────────────────────────────────────────────────────────────

function useElapsedTimer(openedAt: string | null, active: boolean): string {
  const [elapsed, setElapsed] = useState('0:00')

  useEffect(() => {
    if (!openedAt || !active) {
      setElapsed('0:00')
      return
    }
    const tick = () => {
      const diff = Date.now() - new Date(openedAt).getTime()
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setElapsed(`${m}:${s.toString().padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [openedAt, active])

  return elapsed
}

// ─── Metric card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: string | number
  subText?: string
  valueClassName?: string
}

function MetricCard({ label, value, subText, valueClassName = 'text-white' }: MetricCardProps) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-1 text-center">
      <p className="text-xs uppercase tracking-widest text-slate-500 font-medium">{label}</p>
      <p className={`text-3xl font-black tabular-nums leading-none mt-1 ${valueClassName}`}>
        {value}
      </p>
      {subText && <p className="text-xs text-slate-400 mt-0.5">{subText}</p>}
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
      <div className="glass rounded-2xl p-8 text-center flex flex-col items-center gap-3">
        <span className="text-4xl animate-float">⏳</span>
        <p className="text-slate-400 text-base font-medium">ממתין להצעות ראשונות...</p>
      </div>
    )
  }

  const rankBadgeClass = (rank: number) => {
    if (rank === 1) return 'bg-amber-500 text-slate-900'
    if (rank === 2) return 'bg-slate-300 text-slate-900'
    if (rank === 3) return 'bg-amber-700 text-white'
    return 'bg-slate-700 text-slate-200'
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <p className="text-xs uppercase tracking-widest text-slate-400 font-medium">הצעות חיות</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-live-dot" />
          <span className="text-xs text-slate-400">
            <span className="font-bold text-white">{bidderCount}</span> מציעים
          </span>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
        {bids.map((bid, index) => {
          const rank = index + 1
          return (
            <div
              key={`${bid.participant_id}-${bid.amount}`}
              className="flex items-center gap-3 px-4 py-2.5 animate-slide-in-right"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${rankBadgeClass(rank)}`}
              >
                {rank}
              </span>
              <span className="flex-1 text-sm text-slate-200 truncate">
                {bid.participant?.display_name ?? '—'}
              </span>
              <span
                className={`text-sm font-bold tabular-nums ${rank === 1 ? 'text-amber-400' : 'text-slate-300'}`}
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
}

function RoundCard({ summary, prev }: RoundCardProps) {
  const categoryBadge = (cat: string | null) => {
    switch (cat) {
      case 'שיפוט':
        return 'bg-blue-500/20 text-blue-300'
      case 'יחסים':
        return 'bg-pink-500/20 text-pink-300'
      case 'מנהיגות':
        return 'bg-amber-500/20 text-amber-300'
      case 'למידה':
        return 'bg-green-500/20 text-green-300'
      default:
        return 'bg-slate-600/40 text-slate-300'
    }
  }

  const trendArrow = () => {
    if (!prev) return { symbol: '→', className: 'text-slate-500' }
    const diff = summary.participationRate - prev.participationRate
    if (diff > 0) return { symbol: '↑', className: 'text-green-400' }
    if (diff < 0) return { symbol: '↓', className: 'text-red-400' }
    return { symbol: '→', className: 'text-slate-500' }
  }

  const trend = trendArrow()

  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500 font-medium">#{summary.roundNumber}</span>
        {summary.category && (
          <span
            className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${categoryBadge(summary.category)}`}
          >
            {summary.category}
          </span>
        )}
      </div>

      <p className="text-sm font-bold text-white leading-tight">{summary.traitTitle}</p>

      {summary.winnerName ? (
        <div className="flex items-center gap-2 bg-amber-500/10 rounded-lg px-3 py-1.5">
          <span className="text-base">👑</span>
          <span className="text-xs font-bold text-amber-300 truncate">{summary.winnerName}</span>
          {summary.winningBid !== null && (
            <span className="text-xs text-amber-400 tabular-nums mr-auto">
              {summary.winningBid.toLocaleString()}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-500">אין זוכה</span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">
          <span className={`font-bold ${trend.className}`}>{trend.symbol}</span>{' '}
          <span className="text-white font-bold">{summary.participationRate}%</span> השתתפות
        </span>
        {summary.averageBid !== null && (
          <span className="text-slate-500">
            ממוצע{' '}
            <span className="text-slate-300 font-bold">{summary.averageBid.toLocaleString()}</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Category bars ────────────────────────────────────────────────────────────

interface CategoryBarsProps {
  breakdown: CategoryAnalytics[]
}

function CategoryBars({ breakdown }: CategoryBarsProps) {
  if (breakdown.length === 0) return null

  const maxTotal = Math.max(...breakdown.map(c => c.totalWinningBid), 1)

  const barColor = (cat: string) => {
    switch (cat) {
      case 'שיפוט':
        return 'bg-blue-500'
      case 'יחסים':
        return 'bg-pink-500'
      case 'מנהיגות':
        return 'bg-amber-500'
      case 'למידה':
        return 'bg-green-500'
      default:
        return 'bg-slate-500'
    }
  }

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-4">
      <p className="text-sm font-bold uppercase tracking-widest text-slate-400">🗂 קטגוריות</p>
      <div className="flex flex-col gap-3">
        {breakdown.map(cat => {
          const barWidth = Math.round((cat.totalWinningBid / maxTotal) * 100)
          return (
            <div key={cat.category} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-semibold">{cat.category}</span>
                <span className="text-slate-400 tabular-nums">
                  {cat.totalWinningBid.toLocaleString()} מטבעות
                </span>
              </div>
              <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor(cat.category)}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span>{cat.roundCount} סבבים</span>
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

  const maxCumulative = budgetTimeline.length > 0
    ? budgetTimeline[budgetTimeline.length - 1].cumulativeSpent
    : 1

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-4">
      <p className="text-sm font-bold uppercase tracking-widest text-slate-400">💰 תקציב</p>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'נותר', value: totalRemaining.toLocaleString(), color: 'text-green-400' },
          { label: 'הושקע', value: totalSpent.toLocaleString(), color: 'text-red-400' },
          { label: 'יתרה ממוצעת', value: averageWallet.toLocaleString(), color: 'text-blue-400' },
          { label: 'תקציב התחלתי', value: totalStarting.toLocaleString(), color: 'text-slate-300' },
        ].map(stat => (
          <div key={stat.label} className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">
              {stat.label}
            </p>
            <p className={`text-xl font-black tabular-nums ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>ניצול תקציב</span>
          <span className="font-bold text-white">{spendPercent}%</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 rounded-full transition-all duration-700"
            style={{ width: `${spendPercent}%` }}
          />
        </div>
      </div>

      {budgetTimeline.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">לפי סבב</p>
          {budgetTimeline.map(checkpoint => {
            const barWidth = Math.round((checkpoint.cumulativeSpent / maxCumulative) * 100)
            return (
              <div key={checkpoint.roundNumber} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-4 text-left shrink-0">
                  {checkpoint.roundNumber}
                </span>
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500/60 rounded-full transition-all duration-700"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums w-16 text-left shrink-0 truncate">
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalyticsDashboard({ event }: Props) {
  const {
    currentRoundAnalytics,
    cumulativeAnalytics,
    currentBids,
    discussionInsight,
    connectionStatus,
    loading,
    error,
  } = useAdminRealtimeAnalytics(event.id)

  const elapsed = useElapsedTimer(
    currentRoundAnalytics.openedAt,
    currentRoundAnalytics.status === 'open',
  )

  // ── Loading — skeleton UI ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto" dir="rtl">
        <div className="flex flex-col gap-5 p-6 lg:p-8">
          {/* Hero skeleton */}
          <div className="skeleton rounded-3xl h-40 w-full" />
          {/* Metrics skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton rounded-2xl h-24" />
            ))}
          </div>
          {/* Content skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="skeleton rounded-2xl h-64" />
            <div className="skeleton rounded-2xl h-64" />
          </div>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-950" dir="rtl">
        <div className="glass rounded-3xl p-10 text-center max-w-md">
          <p className="text-5xl mb-4">⚠️</p>
          <p className="text-red-400 text-xl font-bold mb-2">שגיאה בטעינת הנתונים</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

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
      ? 'text-green-400'
      : participationRate >= 25
      ? 'text-amber-400'
      : 'text-red-400'

  const sessionInsights =
    completedRounds > 0 ? generateSessionInsights(cumulativeAnalytics) : []

  // Hero card border/background based on status
  const heroBg =
    status === 'open'
      ? 'bg-gradient-to-r from-blue-950 to-slate-900 border border-blue-500/30'
      : status === 'closed'
      ? 'bg-gradient-to-r from-amber-950/50 to-slate-900 border border-amber-500/30'
      : 'bg-slate-900 border border-white/10'

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto" dir="rtl">

      {/* ── Connection warning bar — only when lost, not on initial connecting ── */}
      {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
        <div
          className={`shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${
            connectionStatus === 'error'
              ? 'bg-red-900/60 border-b border-red-700/50 text-red-300'
              : 'bg-amber-900/60 border-b border-amber-700/50 text-amber-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-current animate-live-dot" />
          {connectionStatus === 'error'
            ? 'שגיאת חיבור — מנסה להתחבר מחדש...'
            : 'החיבור החי נותק זמנית. מנסה להתחבר מחדש...'}
        </div>
      )}

      <div className="flex-1 flex flex-col gap-5 p-6 lg:p-8">

        {/* ══════════════════════════════════════════════════════════════════════
            Section 1 — Current round
        ══════════════════════════════════════════════════════════════════════ */}

        {/* Compact hero card */}
        <div className={`rounded-3xl p-6 ${heroBg}`}>
          {status === 'waiting' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-3 py-1 text-slate-400 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  ממתין
                </span>
              </div>
              <p className="text-3xl font-black text-white">ממתינים לסבב הבא</p>
              <p className="text-slate-400 text-sm">
                <span className="font-bold text-white text-base">{registeredParticipants}</span>{' '}
                משתתפים רשומים
              </p>
            </div>
          )}

          {status === 'open' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-3 py-1 text-green-400 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-live-dot" />
                  סבב פתוח
                </span>
                <span className="text-amber-400 font-black text-2xl tabular-nums font-mono">
                  {elapsed}
                </span>
              </div>
              <h2 className="text-3xl font-black text-white leading-tight">{traitTitle}</h2>
              {traitDescription && (
                <p className="text-slate-400 text-base leading-relaxed">{traitDescription}</p>
              )}
            </div>
          )}

          {status === 'closed' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-3 py-1 text-amber-400 text-xs font-bold">
                  הסבב נסגר
                </span>
              </div>
              <h2 className="text-3xl font-black text-white leading-tight">{traitTitle}</h2>
              {winnerName && winningBid !== null && (
                <p className="text-amber-400 text-xl font-black tabular-nums">
                  👑 {winnerName} — {winningBid.toLocaleString()} מטבעות
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
            valueClassName={bidderCount > 0 ? participationColor : 'text-slate-500'}
          />
          <MetricCard
            label="הצעה גבוהה"
            value={highestBid !== null ? highestBid.toLocaleString() : '—'}
            valueClassName={highestBid !== null ? 'text-amber-400' : 'text-slate-500'}
          />
          <MetricCard
            label="ממוצע הצעות"
            value={averageBid !== null ? averageBid.toLocaleString() : '—'}
            valueClassName={averageBid !== null ? 'text-blue-400' : 'text-slate-500'}
          />
          <MetricCard
            label="חציון"
            value={medianBid !== null ? medianBid.toLocaleString() : '—'}
            valueClassName={medianBid !== null ? 'text-slate-300' : 'text-slate-500'}
          />
        </div>

        {/* Two-column live section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Left — live bids or winner or waiting state */}
          <div className="flex flex-col gap-3">
            {status === 'open' && <LiveBidderList bids={currentBids} bidderCount={bidderCount} />}

            {status === 'closed' && winnerName && (
              <div className="rounded-2xl p-6 bg-gradient-to-br from-amber-950 to-slate-900 border-2 border-amber-500/50 flex flex-col gap-2">
                <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">
                  👑 הזוכה
                </p>
                <p className="text-4xl font-black text-white leading-tight">{winnerName}</p>
                {winningBid !== null && (
                  <p className="text-amber-400 text-3xl font-black tabular-nums">
                    {winningBid.toLocaleString()} 🪙
                  </p>
                )}
                <p className="text-slate-400 text-sm mt-1">
                  מתוך <span className="font-bold text-white">{bidderCount}</span> מציעים
                </p>
              </div>
            )}

            {status === 'closed' && !winnerName && (
              <div className="glass rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-4xl">🤷</p>
                <p className="text-slate-300 text-lg font-bold">הסבב נסגר ללא הצעות</p>
                <p className="text-slate-500 text-sm">לא הוגשו הצעות בסבב זה</p>
              </div>
            )}

            {status === 'waiting' && (
              <div className="glass rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-4xl animate-float">🏆</p>
                <p className="text-slate-400 text-base font-medium">ממתינים לפתיחת הסבב</p>
              </div>
            )}
          </div>

          {/* Right — discussion insight or budget mini-summary */}
          <div className="flex flex-col gap-3">
            {discussionInsight ? (
              <div
                className={`glass rounded-2xl p-6 flex flex-col gap-2 border ${
                  status === 'open'
                    ? 'border-blue-500/20 bg-blue-950/20'
                    : 'border-amber-500/20 bg-amber-950/10'
                }`}
              >
                <p
                  className={`text-xs uppercase tracking-widest font-bold ${
                    status === 'open' ? 'text-blue-400' : 'text-amber-500'
                  }`}
                >
                  💬 נקודה לדיון
                </p>
                <p className="text-base font-medium text-slate-200 leading-relaxed">
                  {discussionInsight}
                </p>
              </div>
            ) : (
              <div className="glass rounded-2xl p-5 flex flex-col gap-3">
                <p className="text-xs uppercase tracking-widest text-slate-400 font-medium">
                  תקציב קבוצתי
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: 'נותר לקבוצה',
                      value: totalRemainingBudget.toLocaleString(),
                      color: 'text-green-400',
                    },
                    {
                      label: 'מטבעות שהושקעו',
                      value: totalSpent.toLocaleString(),
                      color: 'text-red-400',
                    },
                    {
                      label: 'יתרה ממוצעת',
                      value: averageRemainingWallet.toLocaleString(),
                      color: 'text-blue-400',
                    },
                    {
                      label: 'תקציב התחלתי',
                      value: totalStartingBudget.toLocaleString(),
                      color: 'text-slate-300',
                    },
                  ].map(stat => (
                    <div key={stat.label} className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">
                        {stat.label}
                      </p>
                      <p className={`text-xl font-black tabular-nums ${stat.color}`}>
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            Section 2 — Completed rounds
        ══════════════════════════════════════════════════════════════════════ */}
        {completedRounds > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-black text-white">📋 סבבים שהסתיימו</h3>
              <span className="bg-slate-700 text-slate-200 text-xs font-bold rounded-full px-2.5 py-0.5">
                {completedRounds}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {roundSummaries.map((summary, i) => (
                <RoundCard
                  key={summary.roundId}
                  summary={summary}
                  prev={i > 0 ? roundSummaries[i - 1] : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            Section 3 — Analysis (categories + budget) — only after 2+ rounds
        ══════════════════════════════════════════════════════════════════════ */}
        {completedRounds >= 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CategoryBars breakdown={categoryBreakdown} />
            <BudgetHealth
              totalStarting={totalStartingBudget}
              totalSpent={totalSpent}
              totalRemaining={totalRemainingBudget}
              averageWallet={averageRemainingWallet}
              completedRounds={completedRounds}
              budgetTimeline={budgetTimeline}
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            Section 4 — Session insights
        ══════════════════════════════════════════════════════════════════════ */}
        {sessionInsights.length > 0 && (
          <div className="glass rounded-2xl p-6 flex flex-col gap-4">
            <p className="text-sm font-bold uppercase tracking-widest text-slate-400">
              💡 תובנות מהסשן
            </p>
            <ul className="flex flex-col gap-2.5 list-none">
              {sessionInsights.map((insight, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-slate-200 text-sm leading-relaxed">{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  )
}
