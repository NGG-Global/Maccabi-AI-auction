'use client'

import { useEffect, useState } from 'react'
import { useAdminRealtimeAnalytics } from '@/lib/hooks/useAdminRealtimeAnalytics'
import type { Event } from '@/lib/types'
import type { TraitRanking } from '@/lib/game/analytics'

interface Props {
  event: Event
}

// ─── Elapsed timer helper ─────────────────────────────────────────────────────

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
    <div className="glass rounded-2xl p-6 flex flex-col gap-1 text-center">
      <p className="text-xs uppercase tracking-widest text-slate-500 font-medium">{label}</p>
      <p className={`text-5xl font-black tabular-nums leading-none mt-1 ${valueClassName}`}>{value}</p>
      {subText && <p className="text-sm text-slate-400 mt-1">{subText}</p>}
    </div>
  )
}

// ─── Trait ranking card ───────────────────────────────────────────────────────

interface RankCardProps {
  ranking: TraitRanking
  rank: number
}

function RankCard({ ranking, rank }: RankCardProps) {
  const badgeClass =
    rank === 1
      ? 'bg-amber-500 text-slate-900'
      : rank === 2
      ? 'bg-slate-300 text-slate-900'
      : rank === 3
      ? 'bg-amber-700 text-white'
      : 'bg-slate-700 text-slate-200'

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-black shrink-0 ${badgeClass}`}
        >
          {rank}
        </span>
        <p className="text-xl font-black text-white leading-tight">{ranking.traitTitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">זכייה</p>
          <p className="text-2xl font-black text-amber-400 tabular-nums mt-0.5">
            {ranking.winningBid !== null ? ranking.winningBid.toLocaleString() : '—'}
          </p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">ממוצע</p>
          <p className="text-2xl font-black text-blue-400 tabular-nums mt-0.5">
            {ranking.averageBid !== null ? ranking.averageBid.toLocaleString() : '—'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">
          <span className="font-bold text-white">{ranking.bidderCount}</span> מציעים
        </span>
        {ranking.winnerName && (
          <span className="text-amber-400 font-bold truncate max-w-[50%]">
            👑 {ranking.winnerName}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalyticsDashboard({ event }: Props) {
  const {
    currentRoundAnalytics,
    cumulativeAnalytics,
    discussionInsight,
    connectionStatus,
    loading,
    error,
  } = useAdminRealtimeAnalytics(event.id)

  const elapsed = useElapsedTimer(
    currentRoundAnalytics.openedAt,
    currentRoundAnalytics.status === 'open',
  )

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full border-4 border-amber-500/30 border-t-amber-500 animate-spin" />
          <p className="text-slate-400 text-lg font-medium">טוען נתונים...</p>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-950">
        <div className="glass rounded-3xl p-10 text-center max-w-md">
          <p className="text-5xl mb-4">⚠️</p>
          <p className="text-red-400 text-xl font-bold mb-2">שגיאה בטעינת הנתונים</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const { status, traitTitle, traitDescription, bidderCount, registeredParticipants,
          participationRate, highestBid, averageBid, medianBid,
          winnerName, winningBid } = currentRoundAnalytics

  const {
    totalStartingBudget, totalSpent, totalRemainingBudget,
    averageRemainingWallet, completedRounds, traitRankings,
  } = cumulativeAnalytics

  // ── Participation color ────────────────────────────────────────────────────
  const participationColor =
    participationRate >= 50
      ? 'text-green-400'
      : participationRate >= 25
      ? 'text-amber-400'
      : 'text-red-400'

  // ── Hero gradient / label ─────────────────────────────────────────────────
  const heroBg =
    status === 'open'
      ? 'bg-gradient-to-r from-blue-950 to-slate-900 border border-blue-500/30'
      : status === 'closed'
      ? 'bg-gradient-to-r from-amber-950/50 to-slate-900 border border-amber-500/30'
      : 'bg-slate-900 border border-white/10'

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto" dir="rtl">

      {/* ── Connection warning bar — only shown after connection is lost, not on initial load ── */}
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

        {/* ── Hero card ────────────────────────────────────────────────────── */}
        <div className={`rounded-3xl p-8 ${heroBg}`}>
          {status === 'waiting' && (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <p className="text-slate-500 text-sm uppercase tracking-widest font-bold">סטטוס</p>
              <p className="text-5xl font-black text-white">⚪ ממתינים לסבב הבא</p>
              <p className="text-slate-400 text-xl">
                <span className="font-black text-white text-2xl">{registeredParticipants}</span> משתתפים רשומים
              </p>
            </div>
          )}

          {status === 'open' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-4 py-1.5 text-green-400 text-sm font-bold">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-live-dot" />
                  🟢 סבב פתוח
                </span>
                <span className="text-amber-400 font-black text-3xl tabular-nums font-mono">{elapsed}</span>
              </div>
              <h2 className="text-5xl lg:text-6xl font-black text-white leading-tight">{traitTitle}</h2>
              {traitDescription && (
                <p className="text-slate-300 text-xl leading-relaxed max-w-3xl">{traitDescription}</p>
              )}
            </div>
          )}

          {status === 'closed' && (
            <div className="flex flex-col gap-4">
              <span className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-1.5 text-amber-400 text-sm font-bold w-fit">
                ✅ הסבב נסגר
              </span>
              <h2 className="text-5xl lg:text-6xl font-black text-white leading-tight">{traitTitle}</h2>
              {winningBid !== null && (
                <p className="text-amber-400 text-3xl font-black tabular-nums">
                  🪙 {winningBid.toLocaleString()} — הצעת הזכייה
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Metrics grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* ── Bottom section ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Left column — discussion insight / winner reveal */}
          <div className="flex flex-col gap-3">
            {status === 'open' && discussionInsight && (
              <div className="glass rounded-2xl p-7 border border-blue-500/20 bg-blue-950/20 flex flex-col gap-3">
                <p className="text-xs uppercase tracking-widest text-blue-400 font-bold">💬 נקודה לדיון</p>
                <p className="text-xl font-medium text-slate-200 leading-relaxed">{discussionInsight}</p>
              </div>
            )}

            {status === 'open' && !discussionInsight && (
              <div className="glass rounded-2xl p-7 flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-4xl animate-float">⏳</p>
                <p className="text-slate-400 text-lg font-medium">ממתין להצעות...</p>
              </div>
            )}

            {status === 'closed' && winnerName && (
              <div className="rounded-2xl p-8 bg-gradient-to-br from-amber-950 to-slate-900 border-2 border-amber-500/50 animate-pulse-gold flex flex-col gap-3">
                <p className="text-amber-400 text-sm font-bold uppercase tracking-widest">👑 הזוכה</p>
                <p className="text-5xl font-black text-white shimmer-gold leading-tight">{winnerName}</p>
                {winningBid !== null && (
                  <p className="text-amber-400 text-4xl font-black tabular-nums">
                    {winningBid.toLocaleString()} 🪙
                  </p>
                )}
                <p className="text-slate-400 text-base mt-1">
                  מתוך <span className="font-bold text-white">{bidderCount}</span> מציעים
                </p>
              </div>
            )}

            {status === 'closed' && !winnerName && (
              <div className="glass rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-4xl">🤷</p>
                <p className="text-slate-300 text-xl font-bold">הסבב נסגר ללא הצעות</p>
                <p className="text-slate-500 text-sm">לא הוגשו הצעות בסבב זה</p>
              </div>
            )}

            {/* Discussion insight after close — most useful moment for group debrief */}
            {status === 'closed' && discussionInsight && (
              <div className="glass rounded-2xl p-6 border border-amber-500/20 bg-amber-950/10 flex flex-col gap-2">
                <p className="text-xs uppercase tracking-widest text-amber-500 font-bold">💬 נקודה לדיון</p>
                <p className="text-lg font-medium text-slate-200 leading-relaxed">{discussionInsight}</p>
              </div>
            )}

            {status === 'waiting' && (
              <div className="glass rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-4xl animate-float">🏆</p>
                <p className="text-slate-400 text-lg font-medium">ממתינים לפתיחת הסבב</p>
              </div>
            )}
          </div>

          {/* Right column — cumulative stats */}
          <div className="glass rounded-2xl p-7 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">תקציב קבוצתי</p>
              <span className="text-xs text-slate-500 bg-slate-800 rounded-full px-3 py-1">
                {completedRounds} סבבים הושלמו
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'תקציב התחלתי', value: totalStartingBudget.toLocaleString(), color: 'text-slate-300' },
                { label: 'מטבעות שהושקעו', value: totalSpent.toLocaleString(), color: 'text-red-400' },
                { label: 'נותר לקבוצה', value: totalRemainingBudget.toLocaleString(), color: 'text-green-400' },
                { label: 'יתרה ממוצעת', value: averageRemainingWallet.toLocaleString(), color: 'text-blue-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-white/5 rounded-xl p-4 text-center">
                  <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">{stat.label}</p>
                  <p className={`text-3xl font-black tabular-nums ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Trait rankings ────────────────────────────────────────────────── */}
        {completedRounds > 0 && (
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-black text-white">🏅 דירוג תכונות</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {traitRankings.map((ranking, index) => (
                <RankCard key={ranking.roundId} ranking={ranking} rank={index + 1} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
