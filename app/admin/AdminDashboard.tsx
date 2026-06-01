'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { Event, AuctionRound, Trait, Bid, Participant } from '@/lib/types'
import { TraitQueue } from './TraitQueue'

interface Props {
  event: Event
  traits: Trait[]
  initialRound: AuctionRound | null
}

interface BidRow extends Bid {
  participant: Participant
}

export default function AdminDashboard({ event, traits, initialRound }: Props) {
  const [currentRound, setCurrentRound] = useState<AuctionRound | null>(initialRound)
  const [bids, setBids] = useState<BidRow[]>([])
  const [participantCount, setParticipantCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [elapsed, setElapsed] = useState('0:00')
  const [roundNumber, setRoundNumber] = useState(0)
  const supabase = useMemo(() => createClient(), [])
  // Keep a ref to currentRound so realtime callbacks always see the latest value
  const currentRoundRef = useRef<AuctionRound | null>(initialRound)
  // Store traits state locally so we can update is_used without page refresh
  const [localTraits, setLocalTraits] = useState<Trait[]>(traits)

  // Drag-and-drop queue — unused traits in admin-controlled order
  const [traitQueue, setTraitQueue] = useState<Trait[]>(() =>
    traits.filter(t => !t.is_used).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  )

  const usedTraits = localTraits.filter(t => t.is_used)

  /* ── keep ref in sync so realtime callbacks are never stale ── */
  useEffect(() => { currentRoundRef.current = currentRound }, [currentRound])

  /* ── sync queue with localTraits: remove used, restore unused after reset ── */
  useEffect(() => {
    setTraitQueue(prev => {
      const unusedById = new Map(localTraits.filter(t => !t.is_used).map(t => [t.id, t]))
      // Preserve admin's custom drag order for traits still in queue
      const kept = prev.filter(t => unusedById.has(t.id))
      const keptIds = new Set(kept.map(t => t.id))
      // Re-add any unused traits missing from queue (e.g. after a reset)
      const restored = [...unusedById.values()]
        .filter(t => !keptIds.has(t.id))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      return [...kept, ...restored]
    })
  }, [localTraits])

  /* ── timer ── */
  useEffect(() => {
    if (!currentRound?.opened_at || currentRound.status !== 'open') {
      setElapsed('0:00')
      return
    }
    const tick = () => {
      const diff = Date.now() - new Date(currentRound.opened_at!).getTime()
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setElapsed(`${m}:${s.toString().padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [currentRound?.opened_at, currentRound?.status])

  const fetchBids = useCallback(async (roundId: string) => {
    const { data } = await supabase
      .from('bids')
      .select('*, participant:participants(*)')
      .eq('round_id', roundId)
      .order('amount', { ascending: false })
    setBids((data ?? []) as BidRow[])
  }, [supabase])

  const fetchParticipantCount = useCallback(async () => {
    const { count } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', event.id)
    setParticipantCount(count ?? 0)
  }, [supabase, event.id])

  const fetchRoundNumber = useCallback(async () => {
    const { count } = await supabase
      .from('auction_rounds')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .in('status', ['open', 'closed'])
    setRoundNumber(count ?? 0)
  }, [supabase, event.id])

  const refreshRound = useCallback(async () => {
    const { data: rounds } = await supabase
      .from('auction_rounds')
      .select('*, trait:traits(*), winner:participants!auction_rounds_winner_participant_id_fkey(*)')
      .eq('event_id', event.id)
      .in('status', ['open', 'closed'])
      .order('created_at', { ascending: false })
      .limit(1)
    const round = (rounds?.[0] ?? null) as AuctionRound | null
    currentRoundRef.current = round
    setCurrentRound(round)
    if (round) fetchBids(round.id)
    else setBids([])
    fetchRoundNumber()
  }, [supabase, event.id, fetchBids, fetchRoundNumber])

  useEffect(() => {
    fetchParticipantCount()
    fetchRoundNumber()
    if (initialRound) fetchBids(initialRound.id)

    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
        if (currentRoundRef.current) fetchBids(currentRoundRef.current.id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_rounds' }, refreshRound)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, fetchParticipantCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'traits' }, async () => {
        const { data } = await supabase.from('traits').select('*').eq('event_id', event.id).order('sort_order')
        if (data) setLocalTraits(data as Trait[])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function showMsg(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleOpenRound() {
    const nextTrait = traitQueue[0]
    if (!nextTrait) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/open-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, traitId: nextTrait.id }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error ?? 'שגיאה'); return }
      showMsg('success', `סבב נפתח: ${nextTrait.title}`)
      await refreshRound()
    } catch { showMsg('error', 'שגיאת רשת') }
    finally { setLoading(false) }
  }

  async function handleCloseRound() {
    if (!currentRound || currentRound.status !== 'open') return
    setLoading(true)
    setConfirmClose(false)
    try {
      const res = await fetch('/api/admin/close-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId: currentRound.id }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error ?? 'שגיאה'); return }
      showMsg('success', `הסבב נסגר!`)
      await refreshRound()
    } catch { showMsg('error', 'שגיאת רשת') }
    finally { setLoading(false) }
  }

  async function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return }
    setConfirmReset(false)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      })
      if (!res.ok) { showMsg('error', 'שגיאה באיפוס'); return }
      showMsg('success', 'האירוע אופס')
      setCurrentRound(null)
      setBids([])
      await refreshRound()
      await fetchParticipantCount()
    } catch { showMsg('error', 'שגיאת רשת') }
    finally { setLoading(false) }
  }

  const leader = bids[0] ?? null
  const highestBid = leader?.amount ?? 0
  const avgBid = bids.length > 0 ? Math.round(bids.reduce((s, b) => s + b.amount, 0) / bids.length) : 0
  const totalBid = bids.reduce((s, b) => s + b.amount, 0)
  const isOpen = currentRound?.status === 'open'
  const isClosed = currentRound?.status === 'closed'

  return (
    <main className="min-h-screen bg-slate-950 flex overflow-hidden" style={{ fontFamily: 'var(--font-heebo), Arial, sans-serif' }}>

      {/* ── Left: Admin Controls ────────────────────────────── */}
      <aside className="w-72 shrink-0 bg-slate-900 border-l border-white/10 flex flex-col gap-4 p-5 overflow-y-auto">

        {/* Branding */}
        <div className="text-center pb-3 border-b border-white/10">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">מכירה פומבית</p>
          <p className="text-slate-300 font-semibold text-sm truncate">{event.name}</p>
        </div>

        {/* Status */}
        <div className={`rounded-xl px-4 py-3 text-center text-sm font-bold ${
          isOpen ? 'bg-green-500/15 text-green-400 border border-green-500/30' :
          isClosed ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
          'bg-slate-800 text-slate-400'
        }`}>
          {isOpen ? '🟢 סבב פתוח' : isClosed ? '🟡 סבב נסגר' : '⚪ ממתין'}
        </div>

        {/* Toast */}
        {message && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium animate-slide-in-up text-center ${
            message.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {/* Trait queue */}
        <TraitQueue
          queue={traitQueue}
          usedTraits={usedTraits}
          disabled={loading || isOpen}
          onReorder={setTraitQueue}
        />

        {/* Open round */}
        <button
          onClick={handleOpenRound}
          disabled={loading || traitQueue.length === 0 || isOpen}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white rounded-xl py-3 font-bold text-sm transition-all active:scale-95 w-full"
        >
          {loading && !isOpen
            ? 'פותח...'
            : traitQueue[0]
            ? `▶ פתח: ${traitQueue[0].title}`
            : '▶ פתח סבב'}
        </button>

        {/* Close round */}
        {isOpen && (
          <div className="flex flex-col gap-2">
            {!confirmClose ? (
              <button
                onClick={() => setConfirmClose(true)}
                disabled={loading}
                className="bg-red-600/80 hover:bg-red-500 disabled:opacity-30 text-white rounded-xl py-3 font-bold text-sm transition-all active:scale-95 w-full border border-red-500/50"
              >
                ⏹ סגור סבב
              </button>
            ) : (
              <div className="flex flex-col gap-2 animate-scale-in">
                <p className="text-xs text-red-400 text-center">בטוח לסגור את הסבב?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmClose(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-2.5 text-sm font-medium transition-all">
                    ביטול
                  </button>
                  <button onClick={handleCloseRound} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-bold transition-all">
                    {loading ? '...' : 'אשר'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-white/10" />

        {/* Quick stats */}

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'משתתפים', value: participantCount },
            { label: 'מציעים', value: bids.length },
            { label: 'הגבוה', value: highestBid || '—' },
            { label: 'ממוצע', value: avgBid || '—' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/60 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-lg font-bold text-white mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Reset */}
        <div className="mt-auto pt-4 border-t border-white/10">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              disabled={loading}
              className="w-full bg-transparent hover:bg-red-900/30 border border-red-900/50 text-red-500 hover:text-red-400 rounded-xl py-2.5 text-xs font-medium transition-all"
            >
              🔄 איפוס משחק
            </button>
          ) : (
            <div className="flex flex-col gap-2 animate-scale-in bg-red-950/40 border border-red-700/50 rounded-xl p-3">
              <p className="text-red-400 text-xs font-bold text-center">⚠️ איפוס מלא</p>
              <p className="text-slate-400 text-[11px] text-center leading-relaxed">
                ימחקו כל המשתתפים, ההצעות והסבבים. פעולה זו אינה הפיכה.
              </p>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-2 text-xs font-medium transition-all"
                >
                  ביטול
                </button>
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg py-2 text-xs font-bold transition-all"
                >
                  {loading ? '...' : 'אשר איפוס'}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Right: Stage / Audience Display ────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header bar */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 bg-slate-900/50">
          <div className="flex items-center gap-3">
            {isOpen && (
              <span className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 rounded-full px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-live-dot" />
                <span className="text-red-400 text-xs font-bold uppercase tracking-widest">LIVE</span>
              </span>
            )}
            {roundNumber > 0 && (
              <span className="text-slate-400 text-sm">סבב {roundNumber}</span>
            )}
          </div>

          <h1 className="text-slate-300 font-semibold text-lg">{event.name}</h1>

          <div className="flex items-center gap-4 text-sm text-slate-400">
            {isOpen && (
              <span className="tabular-nums font-mono text-amber-400 font-bold">{elapsed}</span>
            )}
            <span>{participantCount} משתתפים</span>
          </div>
        </header>

        {/* Main stage */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 p-8 overflow-y-auto">

          {/* ── Trait + Leader (left-ish column on wide screens) ── */}
          <div className="flex-1 flex flex-col gap-6">

            {/* No round */}
            {!currentRound && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in">
                <div className="text-8xl animate-float">🏆</div>
                <div className="text-center">
                  <p className="text-4xl font-black text-white mb-2">ממתינים לסבב הבא</p>
                  <p className="text-slate-500 text-lg">בחרו תכונה ולחצו על &quot;פתח סבב&quot;</p>
                </div>
                <div className="bg-slate-800/50 rounded-2xl px-8 py-4 border border-white/10">
                  <p className="text-slate-400 text-2xl font-bold">{participantCount} <span className="text-slate-500 text-lg font-normal">משתתפים רשומים</span></p>
                </div>
              </div>
            )}

            {/* Current trait card */}
            {currentRound && (
              <div
                key={currentRound.id}
                className={`rounded-3xl p-8 border animate-scale-in ${
                  isOpen
                    ? 'bg-gradient-to-br from-blue-950 to-slate-900 border-blue-500/30'
                    : 'bg-gradient-to-br from-slate-900 to-slate-950 border-white/10'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                    isOpen ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {isOpen ? 'מתמודדים עכשיו' : 'הסבב הסתיים'}
                  </span>
                  {isClosed && currentRound.winning_bid_amount && (
                    <span className="text-amber-400 font-bold text-sm">זכייה: {currentRound.winning_bid_amount.toLocaleString()} 🪙</span>
                  )}
                </div>
                <h2 className={`font-black mb-3 ${isOpen ? 'text-5xl text-white' : 'text-4xl text-slate-300'}`}>
                  {currentRound.trait?.title}
                </h2>
                <p className="text-slate-400 text-lg leading-relaxed">
                  {currentRound.trait?.description}
                </p>
              </div>
            )}

            {/* Winner reveal */}
            {isClosed && currentRound?.winner && (
              <div
                key={`winner-${currentRound.id}`}
                className="rounded-3xl p-8 bg-gradient-to-br from-amber-950 to-slate-900 border-2 border-amber-500/50 animate-winner-reveal animate-pulse-gold"
              >
                <p className="text-amber-400 text-sm font-bold uppercase tracking-widest mb-3">👑 הזוכה</p>
                <p className="text-6xl font-black text-white mb-2 shimmer-gold">
                  {(currentRound.winner as Participant).display_name}
                </p>
                <p className="text-amber-400 text-4xl font-black">
                  {currentRound.winning_bid_amount?.toLocaleString()} 🪙
                </p>
              </div>
            )}

            {/* Stats row — shown when there are bids */}
            {bids.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'מציעים', value: bids.length, color: 'text-blue-400' },
                  { label: 'הצעה גבוהה', value: `${highestBid.toLocaleString()} 🪙`, color: 'text-amber-400' },
                  { label: 'ממוצע', value: `${avgBid.toLocaleString()} 🪙`, color: 'text-green-400' },
                ].map(s => (
                  <div key={s.label} className="glass rounded-2xl p-4 text-center">
                    <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">{s.label}</p>
                    <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Leader Spotlight + Bid Leaderboard ── */}
          {currentRound && bids.length > 0 && (
            <div className="lg:w-96 flex flex-col gap-4">

              {/* Leader spotlight */}
              {leader && (
                <div
                  key={`leader-${leader.participant_id}-${leader.amount}`}
                  className="rounded-3xl p-6 bg-gradient-to-br from-amber-950/80 to-slate-900 border-2 border-amber-400/60 animate-pulse-gold animate-scale-in"
                >
                  <p className="text-amber-400/80 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>👑</span> מציע מוביל
                  </p>
                  <p className="text-white text-3xl font-black mb-1 truncate">{leader.participant?.display_name}</p>
                  <p className="text-5xl font-black shimmer-gold">{leader.amount.toLocaleString()}</p>
                  <p className="text-amber-600 text-sm mt-1">מטבעות</p>
                </div>
              )}

              {/* Live bid list */}
              <div className="glass rounded-3xl overflow-hidden flex-1">
                <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                  <span className="text-slate-400 text-xs uppercase tracking-widest font-bold">טבלת הצעות</span>
                  {isOpen && <span className="flex items-center gap-1.5 text-xs text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-live-dot" />חי</span>}
                </div>
                <div className="overflow-y-auto max-h-80">
                  {bids.map((bid, i) => (
                    <div
                      key={`${bid.participant_id}-${bid.amount}`}
                      className="flex items-center gap-3 px-5 py-3 border-b border-white/5 animate-slide-in-right hover:bg-white/5 transition-colors"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      {/* Rank badge */}
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                        i === 0 ? 'bg-amber-500 text-slate-900' :
                        i === 1 ? 'bg-slate-400 text-slate-900' :
                        i === 2 ? 'bg-amber-700 text-white' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="flex-1 text-white font-medium text-sm truncate">{bid.participant?.display_name}</span>
                      <span className={`font-black tabular-nums text-sm ${i === 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {bid.amount.toLocaleString()} 🪙
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* No bids yet message when round is open */}
          {isOpen && bids.length === 0 && (
            <div className="lg:w-72 flex flex-col items-center justify-center gap-3 animate-fade-in">
              <div className="glass rounded-3xl p-8 text-center w-full">
                <p className="text-5xl mb-3 animate-float">⏳</p>
                <p className="text-slate-400 text-lg font-medium">ממתין להצעות</p>
                <p className="text-slate-600 text-sm mt-1">המשתתפים ממלאים את הטפסים...</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}
