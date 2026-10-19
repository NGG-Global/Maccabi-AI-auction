'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { DB_SCHEMA } from '@/lib/supabase/schema'
import type { Event, AuctionRound, Trait, GameMode } from '@/lib/types'
import JoinShare from '@/components/admin/JoinShare'
import GameModeSwitch from '@/components/admin/GameModeSwitch'
import ResetControl from '@/components/admin/ResetControl'
import { summarizeAllocation, sortRoundsByTrait, ROUND_WINNERS_SELECT, type AllocationBidRow } from '@/lib/game/allocation'

interface Props {
  event: Event
  traits: Trait[]
  onModeChange: (mode: GameMode) => void
}

interface BidRow extends AllocationBidRow {
  participant_id: string
}

type Phase = 'waiting' | 'open' | 'closed'

/**
 * Facilitator controls + projected display for the budget-allocation mode.
 * While the allocation is open the room only sees participation, not
 * amounts; the per-trait results are revealed when it closes.
 */
export default function AllocationDashboard({ event, traits, onModeChange }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [rounds, setRounds] = useState<AuctionRound[]>([])
  const [bids, setBids] = useState<BidRow[]>([])
  const [participantCount, setParticipantCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const roundIdsRef = useRef<string[]>([])

  const sortedTraits = useMemo(
    () => [...traits].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [traits],
  )

  const phase: Phase =
    rounds.some(r => r.status === 'open') ? 'open' : rounds.length > 0 ? 'closed' : 'waiting'
  const openedAt = rounds.find(r => r.opened_at)?.opened_at ?? null

  /* ── timer ── */
  useEffect(() => {
    if (!openedAt || phase !== 'open') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [openedAt, phase])

  const elapsedMs = openedAt && phase === 'open' ? Math.max(0, now - new Date(openedAt).getTime()) : 0
  const elapsed = `${Math.floor(elapsedMs / 60000)}:${Math.floor((elapsedMs % 60000) / 1000).toString().padStart(2, '0')}`

  const fetchBids = useCallback(async (roundIds: string[]) => {
    if (roundIds.length === 0) { setBids([]); return }
    const { data } = await supabase
      .from('bids')
      .select('round_id, participant_id, amount')
      .in('round_id', roundIds)
    setBids((data ?? []) as BidRow[])
  }, [supabase])

  const fetchParticipantCount = useCallback(async () => {
    const { count } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', event.id)
    setParticipantCount(count ?? 0)
  }, [supabase, event.id])

  const refreshRounds = useCallback(async () => {
    const { data } = await supabase
      .from('auction_rounds')
      .select(`*, trait:traits(*), ${ROUND_WINNERS_SELECT}`)
      .eq('event_id', event.id)
      .in('status', ['open', 'closed'])
    const list = sortRoundsByTrait((data ?? []) as AuctionRound[])
    roundIdsRef.current = list.map(r => r.id)
    setRounds(list)
    await fetchBids(roundIdsRef.current)
  }, [supabase, event.id, fetchBids])

  useEffect(() => {
    refreshRounds()
    fetchParticipantCount()

    // Throttle — with ~100 phones auto-saving, coalesce bid events into at
    // most one fetch per 250 ms without letting a steady stream postpone it.
    let bidsTimer: ReturnType<typeof setTimeout> | null = null
    const throttledFetchBids = () => {
      if (bidsTimer) return
      bidsTimer = setTimeout(() => {
        bidsTimer = null
        fetchBids(roundIdsRef.current)
      }, 250)
    }
    let roundsTimer: ReturnType<typeof setTimeout> | null = null
    const throttledRefreshRounds = () => {
      if (roundsTimer) return
      roundsTimer = setTimeout(() => {
        roundsTimer = null
        refreshRounds()
      }, 250)
    }

    const channel = supabase
      .channel(`admin-allocation-${event.id}`)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'bids' }, throttledFetchBids)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'auction_rounds', filter: `event_id=eq.${event.id}` }, throttledRefreshRounds)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'participants', filter: `event_id=eq.${event.id}` }, fetchParticipantCount)
      .subscribe()

    return () => {
      if (bidsTimer) clearTimeout(bidsTimer)
      if (roundsTimer) clearTimeout(roundsTimer)
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function showMsg(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleOpen() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/open-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error ?? 'שגיאה'); return }
      showMsg('success', `החלוקה נפתחה: ${data.roundCount} כישורים`)
      await refreshRounds()
    } catch { showMsg('error', 'שגיאת רשת') }
    finally { setLoading(false) }
  }

  async function handleClose() {
    setLoading(true)
    setConfirmClose(false)
    try {
      const res = await fetch('/api/admin/close-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error ?? 'שגיאה'); return }
      const ties = Number(data.tiedTraits ?? 0)
      showMsg('success', ties > 0
        ? `החלוקה נסגרה. ${ties === 1 ? 'כישור אחד הסתיים' : `${ties} כישורים הסתיימו`} בשוויון וזכייה משותפת`
        : 'החלוקה נסגרה והזוכים חושבו')
      await refreshRounds()
    } catch { showMsg('error', 'שגיאת רשת') }
    finally { setLoading(false) }
  }

  async function handleAfterReset() {
    showMsg('success', 'האירוע אופס')
    await refreshRounds()
    await fetchParticipantCount()
  }

  const allocatorCount = useMemo(() => new Set(bids.map(b => b.participant_id)).size, [bids])
  const totalAllocated = useMemo(() => bids.reduce((s, b) => s + b.amount, 0), [bids])
  const participationPct = participantCount > 0 ? Math.round((allocatorCount / participantCount) * 100) : 0
  const results = useMemo(
    () => (phase === 'closed' ? summarizeAllocation(rounds, bids) : []),
    [phase, rounds, bids],
  )
  const maxTotal = results[0]?.totalAllocated ?? 0

  return (
    <main className="min-h-screen bg-slate-950 flex overflow-hidden" style={{ fontFamily: 'var(--font-heebo), Arial, sans-serif' }}>

      {/* ── Admin controls ───────────────────────────────────── */}
      <aside className="w-72 shrink-0 bg-slate-900 border-l border-white/10 flex flex-col gap-4 p-5 overflow-y-auto">

        <div className="text-center pb-3 border-b border-white/10">
          <p className="text-slate-400 text-xs truncate">{event.name}</p>
        </div>

        <div className={`rounded-xl px-4 py-3 text-center text-sm font-bold ${
          phase === 'open' ? 'bg-green-500/15 text-green-400 border border-green-500/30' :
          phase === 'closed' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
          'bg-slate-800 text-slate-400'
        }`}>
          {phase === 'open' ? '🟢 החלוקה פתוחה' : phase === 'closed' ? '🟡 החלוקה נסגרה' : '⚪ ממתין לפתיחה'}
        </div>

        <GameModeSwitch
          eventId={event.id}
          mode="allocation"
          locked={rounds.length > 0}
          onChange={onModeChange}
        />

        {message && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium animate-slide-in-up text-center ${
            message.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {/* Traits in this allocation */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">כישורים בחלוקה</p>
            <span className="text-[10px] text-slate-600">{sortedTraits.length}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {sortedTraits.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-slate-800/60">
                <span className="text-xs font-black shrink-0 w-5 text-center text-slate-600">{i + 1}</span>
                <span className="flex-1 font-medium truncate text-slate-300">{t.title}</span>
              </div>
            ))}
          </div>
        </div>

        {phase === 'waiting' && (
          <button
            onClick={handleOpen}
            disabled={loading || sortedTraits.length === 0}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white rounded-xl py-3 font-bold text-sm transition-all active:scale-95 w-full"
          >
            {loading ? 'פותח...' : '▶ פתח חלוקה – כל הכישורים יחד'}
          </button>
        )}

        {phase === 'open' && (
          <div className="flex flex-col gap-2">
            {!confirmClose ? (
              <button
                onClick={() => setConfirmClose(true)}
                disabled={loading}
                className="bg-red-600/80 hover:bg-red-500 disabled:opacity-30 text-white rounded-xl py-3 font-bold text-sm transition-all active:scale-95 w-full border border-red-500/50"
              >
                ⏹ סגור חלוקה וחשב זוכים
              </button>
            ) : (
              <div className="flex flex-col gap-2 animate-scale-in">
                <p className="text-xs text-red-400 text-center leading-relaxed">
                  לסגור את החלוקה? לאחר הסגירה אי אפשר לשנות, וכל המטבעות שהוקצו יורדו מהיתרות.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmClose(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-2.5 text-sm font-medium transition-all">
                    ביטול
                  </button>
                  <button onClick={handleClose} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-bold transition-all">
                    {loading ? '...' : 'אשר'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'closed' && (
          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            לחלוקה חוזרת יש לאפס את המשחק.
          </p>
        )}

        <div className="border-t border-white/10" />

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'משתתפים', value: participantCount },
            { label: 'שמרו חלוקה', value: phase === 'waiting' ? '—' : allocatorCount },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/60 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-lg font-bold text-white mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-4 border-t border-white/10">
          <ResetControl
            eventId={event.id}
            disabled={loading}
            onReset={handleAfterReset}
            onError={text => showMsg('error', text)}
          />
        </div>
      </aside>

      {/* ── Stage / audience display ─────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        <div className={`h-0.5 shrink-0 transition-all duration-300 ${loading ? 'bg-amber-400/60' : 'bg-transparent'}`} />

        <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 bg-slate-900/50">
          <div className="flex items-center gap-3">
            {phase === 'open' && (
              <span className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 rounded-full px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-live-dot" />
                <span className="text-red-400 text-xs font-bold uppercase tracking-widest">LIVE</span>
              </span>
            )}
            <span className="text-slate-400 text-sm">חלוקת תקציב</span>
          </div>

          <h1 className="text-slate-300 font-semibold text-lg">{event.name}</h1>

          <div className="flex items-center gap-4 text-sm text-slate-400">
            {phase === 'open' && (
              <span className="tabular-nums font-mono text-amber-400 font-bold">{elapsed}</span>
            )}
            <span>{participantCount} משתתפים</span>
            <JoinShare slug={event.slug} />
          </div>
        </header>

        <div className="flex-1 flex flex-col gap-6 p-8 overflow-y-auto">

          {/* Waiting */}
          {phase === 'waiting' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-8 animate-fade-in">
              <div className="text-8xl animate-float">🧩</div>
              <div className="text-center max-w-2xl">
                <p className="text-4xl font-black text-white mb-3">חלוקת תקציב</p>
                <p className="text-slate-400 text-xl leading-relaxed">
                  כל הכישורים ייפתחו יחד. לכל משתתף 1,000 מטבעות לחלק ביניהם לפי מה שחשוב לו.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-3xl">
                {sortedTraits.map(t => (
                  <span key={t.id} className="glass rounded-full px-4 py-2 text-slate-200 text-sm font-medium">{t.title}</span>
                ))}
              </div>
              <div className="bg-slate-800/50 rounded-2xl px-8 py-4 border border-white/10">
                <p className="text-slate-400 text-2xl font-bold">{participantCount} <span className="text-slate-500 text-lg font-normal">משתתפים רשומים</span></p>
              </div>
            </div>
          )}

          {/* Open — participation only, amounts stay hidden until close */}
          {phase === 'open' && (
            <div className="flex flex-col gap-6 animate-scale-in">
              <div className="rounded-3xl p-8 bg-gradient-to-br from-blue-950 to-slate-900 border border-blue-500/30">
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-blue-500/20 text-blue-400">
                  החלוקה פתוחה
                </span>
                <h2 className="text-5xl font-black text-white mt-4 mb-2">חלקו את 1,000 המטבעות שלכם</h2>
                <p className="text-slate-400 text-lg">אפשר לשנות את החלוקה עד שהחלוקה נסגרת. התוצאות ייחשפו בסגירה.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                  {rounds.map((r, i) => (
                    <div key={r.id} className="glass rounded-2xl px-5 py-4 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-sm font-black shrink-0">{i + 1}</span>
                      <span className="text-white text-lg font-bold leading-tight">{r.trait?.title}</span>
                    </div>
                  ))}
                </div>

                <div className="glass rounded-3xl p-8 flex flex-col items-center justify-center gap-4 text-center">
                  <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">שמרו חלוקה</p>
                  <p key={allocatorCount} className="text-7xl font-black text-white tabular-nums animate-scale-in">
                    {allocatorCount}
                    <span className="text-3xl text-slate-500 font-bold"> / {participantCount}</span>
                  </p>
                  <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${participationPct}%` }} />
                  </div>
                  <p className="text-green-400 font-bold">{participationPct}%</p>
                </div>
              </div>
            </div>
          )}

          {/* Closed — results reveal */}
          {phase === 'closed' && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                  <p className="text-amber-400 text-sm font-bold uppercase tracking-widest mb-1">תוצאות החלוקה</p>
                  <h2 className="text-4xl font-black text-white">איפה הקבוצה שמה את הכסף</h2>
                </div>
                <div className="flex gap-3">
                  {[
                    { label: 'מטבעות שהוקצו', value: totalAllocated.toLocaleString() },
                    { label: 'משתתפים שחילקו', value: allocatorCount },
                    { label: 'ממוצע למשתתף', value: allocatorCount > 0 ? Math.round(totalAllocated / allocatorCount).toLocaleString() : '—' },
                  ].map(s => (
                    <div key={s.label} className="glass rounded-2xl px-5 py-3 text-center">
                      <p className="text-slate-500 text-[10px] uppercase tracking-wide">{s.label}</p>
                      <p className="text-2xl font-black text-white tabular-nums">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {results.map((r, i) => (
                  <div
                    key={r.roundId}
                    className={`rounded-2xl px-5 py-4 flex items-center gap-4 animate-slide-in-right ${
                      i === 0 && r.totalAllocated > 0
                        ? 'bg-gradient-to-l from-amber-950/80 to-slate-900 border-2 border-amber-400/60'
                        : 'glass'
                    }`}
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                      i === 0 ? 'bg-amber-500 text-slate-900' :
                      i === 1 ? 'bg-slate-300 text-slate-900' :
                      i === 2 ? 'bg-amber-700 text-white' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {i + 1}
                    </span>

                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-white text-xl font-black truncate">{r.traitTitle}</span>
                        <span className="text-amber-400 text-2xl font-black tabular-nums shrink-0">
                          {r.totalAllocated.toLocaleString()} 🪙
                        </span>
                      </div>
                      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-700"
                          style={{ width: `${maxTotal > 0 ? Math.round((r.totalAllocated / maxTotal) * 100) : 0}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                        <span>{r.sharePercent}% מהתקציב שהוקצה</span>
                        <span>{r.supporterCount} השקיעו</span>
                        {r.averageAllocation !== null && <span>ממוצע {r.averageAllocation.toLocaleString()}</span>}
                      </div>
                    </div>

                    <div className="w-44 shrink-0 text-left border-r border-white/10 pr-4">
                      {r.winnerNames.length > 1 ? (
                        <>
                          <p className="text-amber-400/80 text-[10px] font-bold uppercase tracking-widest">🤝 שוויון · זכייה משותפת</p>
                          {r.winnerNames.map(name => (
                            <p key={name} className="text-white font-black truncate leading-snug">{name}</p>
                          ))}
                          <p className="text-amber-400 text-sm font-bold tabular-nums">{r.winningAmount?.toLocaleString()} 🪙 כל אחד</p>
                        </>
                      ) : r.winnerNames.length === 1 ? (
                        <>
                          <p className="text-amber-400/80 text-[10px] font-bold uppercase tracking-widest">👑 זוכה</p>
                          <p className="text-white font-black truncate">{r.winnerNames[0]}</p>
                          <p className="text-amber-400 text-sm font-bold tabular-nums">{r.winningAmount?.toLocaleString()} 🪙</p>
                        </>
                      ) : (
                        <p className="text-slate-500 text-sm">אין זוכה</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
