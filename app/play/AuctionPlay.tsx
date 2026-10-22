'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { DB_SCHEMA } from '@/lib/supabase/schema'
import type { AuctionRound, Participant, Bid, PublicRoom } from '@/lib/types'
import { ROUND_SELECT } from '@/lib/supabase/embeds'
import { useRoundTimer } from '@/lib/hooks/useRoundTimer'
import { PlaySkeleton, PlayError, WalletHeader } from './PlayShell'

interface GameState {
  participant: Participant | null
  currentRound: AuctionRound | null
  myBid: Bid | null
  loading: boolean
  error: string | null
}

interface RoundStats {
  bidderCount: number   // have a bid in this round
  noBidCount: number    // wallet > 0 but no bid yet
  foldedCount: number   // wallet = 0, cannot bid
  highestBid: number
  isLeading: boolean    // current participant would win if the round closed now
  isTiedBehind: boolean // matches the top bid, but someone reached it first
}

const EMPTY_STATS: RoundStats = { bidderCount: 0, noBidCount: 0, foldedCount: 0, highestBid: 0, isLeading: false, isTiedBehind: false }

interface Props {
  room: PublicRoom
  participantId: string
  sessionToken: string
}

export default function AuctionPlay({ room, participantId, sessionToken }: Props) {
  const [state, setState] = useState<GameState>({ participant: null, currentRound: null, myBid: null, loading: true, error: null })
  const [roundStats, setRoundStats] = useState<RoundStats>(EMPTY_STATS)
  const [bidInput, setBidInput] = useState('')
  const [bidSubmitting, setBidSubmitting] = useState(false)
  const [bidError, setBidError] = useState<string | null>(null)
  const [bidSuccess, setBidSuccess] = useState(false)
  const bidSoundRef = useRef<HTMLAudioElement | null>(null)
  const fetchSeqRef = useRef(0)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    bidSoundRef.current = new Audio('/bid-success.mp3')
    bidSoundRef.current.preload = 'auto'
  }, [])

  const fetchRoundStats = useCallback(async (roundId: string, roomId: string, participantId: string) => {
    const [{ data: allParticipants }, { data: bids }] = await Promise.all([
      supabase.from('participants').select('id, wallet_balance').eq('room_id', roomId),
      // Same order as the server's tie-break: highest amount, then first to reach it.
      supabase.from('bids').select('participant_id, amount').eq('round_id', roundId)
        .order('amount', { ascending: false }).order('updated_at', { ascending: true }),
    ])

    const bidderIds = new Set((bids ?? []).map(b => b.participant_id))
    const highestBid = bids?.[0]?.amount ?? 0

    const bidderCount = bidderIds.size
    const foldedCount = (allParticipants ?? []).filter(p => p.wallet_balance === 0 && !bidderIds.has(p.id)).length
    const noBidCount = (allParticipants ?? []).length - bidderCount - foldedCount

    // Leading = first in tie-break order. Matching the top bid after someone
    // else reached it is a tie this participant would lose.
    const myAmount = bids?.find(b => b.participant_id === participantId)?.amount ?? 0
    const isLeading = myAmount > 0 && bids?.[0]?.participant_id === participantId
    const isTiedBehind = myAmount > 0 && myAmount === highestBid && !isLeading

    setRoundStats({ bidderCount, noBidCount: Math.max(0, noBidCount), foldedCount, highestBid, isLeading, isTiedBehind })
  }, [supabase])

  const fetchState = useCallback(async (participantId: string) => {
    // Responses can arrive out of order under load; only the latest call may write state.
    const seq = ++fetchSeqRef.current
    const { data: participant } = await supabase
      .from('participants').select('*').eq('id', participantId).eq('room_id', room.id).maybeSingle<Participant>()
    if (!participant) {
      setState(prev => ({ ...prev, loading: false, error: 'המשתתף לא נמצא (ייתכן שהחדר אופס). סרקו את קוד ה-QR והירשמו מחדש.' }))
      return
    }

    const { data: rounds } = await supabase
      .from('auction_rounds')
      .select(ROUND_SELECT)
      .eq('room_id', room.id)
      .in('status', ['open', 'closed'])
      .order('created_at', { ascending: false })
      .limit(1)

    const round = (rounds?.[0] ?? null) as AuctionRound | null

    let myBid: Bid | null = null
    if (round) {
      const { data: bid } = await supabase
        .from('bids').select('*').eq('round_id', round.id).eq('participant_id', participantId).maybeSingle<Bid>()
      myBid = bid ?? null
    }

    if (seq !== fetchSeqRef.current) return
    setState(prev => ({ ...prev, participant, currentRound: round, myBid, loading: false }))

    if (round?.status === 'open') {
      fetchRoundStats(round.id, room.id, participantId)
    } else {
      setRoundStats(EMPTY_STATS)
    }
  }, [supabase, fetchRoundStats, room.id])

  useEffect(() => {
    fetchState(participantId)

    // Throttle — with ~100 phones each refetching on every bid, a burst of bids
    // would otherwise multiply into thousands of queries. At most one refresh
    // per 300 ms, and a steady stream of bids cannot postpone it.
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = () => {
      if (refreshTimer) return
      refreshTimer = setTimeout(() => {
        refreshTimer = null
        fetchState(participantId)
      }, 300)
    }

    // Only this room's rounds and bids reach this phone.
    const channel = supabase.channel(`play-${room.id}-${participantId}`)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'auction_rounds', filter: `room_id=eq.${room.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'bids', filter: `room_id=eq.${room.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'participants', filter: `id=eq.${participantId}` }, scheduleRefresh)
      .subscribe()
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBidSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseInt(bidInput, 10)
    if (isNaN(amount)) return
    setBidSubmitting(true)
    setBidError(null)
    setBidSuccess(false)
    setBidInput('')
    try {
      const res = await fetch('/api/bid/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, roomId: room.id, roundId: state.currentRound?.id, amount }),
      })
      const data = await res.json()
      if (!res.ok) { setBidError(data.error ?? 'שגיאה') }
      else {
        setState(prev => ({
          ...prev,
          myBid: {
            id: 'optimistic',
            room_id: room.id,
            round_id: state.currentRound?.id ?? '',
            participant_id: prev.participant?.id ?? '',
            amount,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }))
        setBidSuccess(true)
        if (bidSoundRef.current) {
          bidSoundRef.current.currentTime = 0
          bidSoundRef.current.play().catch(() => {})
        }
        fetchState(participantId)
      }
    } catch { setBidError('שגיאת רשת. נסו שוב.') }
    finally { setBidSubmitting(false) }
  }

  const { participant, currentRound, myBid, loading, error } = state
  const timer = useRoundTimer(currentRound?.opened_at ?? null, currentRound?.status === 'open', room.default_round_seconds)

  if (loading) return <PlaySkeleton />

  if (error || !participant) return <PlayError message={error ?? 'שגיאה לא צפויה'} />

  const isOpen = currentRound?.status === 'open'
  const isClosed = currentRound?.status === 'closed'
  const iWon = isClosed && currentRound?.winner_participant_id === participant.id

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col">

      <WalletHeader room={room} name={participant.display_name} balance={participant.wallet_balance} />

      <div className="flex-1 flex flex-col px-4 py-6 gap-4">

        {/* Waiting */}
        {!currentRound && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in">
            <div className="text-7xl animate-float">🏆</div>
            <div className="text-center">
              <p className="text-white text-2xl font-black mb-2">ממתינים להתחלה</p>
              <p className="text-slate-500">הסבב הבא יתחיל בקרוב</p>
            </div>
          </div>
        )}

        {/* Round closed result */}
        {isClosed && (
          <div key={`closed-${currentRound!.id}`} className={`rounded-3xl p-6 border-2 text-center animate-scale-in ${
            iWon
              ? 'bg-gradient-to-br from-amber-950 to-slate-900 border-amber-400/60 animate-pulse-gold'
              : 'bg-slate-900 border-white/10'
          }`}>
            {iWon ? (
              <>
                <p className="text-5xl mb-3">🏆</p>
                <p className="text-amber-400 text-2xl font-black mb-1">זכית!</p>
                <p className="text-slate-300 text-sm">בהיגד: <span className="text-white font-bold">{currentRound!.trait?.title}</span></p>
              </>
            ) : (
              <>
                <p className="text-4xl mb-3">🤷</p>
                <p className="text-white text-xl font-bold mb-1">הסבב נסגר</p>
                {myBid && <p className="text-slate-400 text-sm">הגשת הצעה של <span className="text-white font-bold">{myBid.amount} 🪙</span></p>}
                {myBid && myBid.amount === currentRound!.winning_bid_amount && (
                  <p className="text-amber-300/90 text-sm mt-1">⏱️ שוויון — הוכרע לטובת מי שהציע את הסכום ראשון</p>
                )}
                {!myBid && <p className="text-slate-500 text-sm">לא הגשת הצעה בסבב זה</p>}
              </>
            )}
          </div>
        )}

        {/* Open round */}
        {isOpen && (
          <div key={`open-${currentRound!.id}`} className="flex flex-col gap-4 animate-slide-in-up">

            {/* Trait card */}
            <div className="bg-gradient-to-br from-blue-950 to-slate-900 rounded-3xl p-6 border border-blue-500/30">
              <span className="text-blue-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-live-dot" />
                סבב פתוח
                {timer.remaining !== null && (
                  <span className={`mr-auto tabular-nums font-mono text-sm ${timer.overtime ? 'text-red-400' : 'text-amber-400'}`}>
                    {timer.overtime ? 'הזמן נגמר' : `⏳ ${timer.remaining}`}
                  </span>
                )}
              </span>
              <h2 className={`text-3xl font-black text-white ${currentRound!.trait?.description ? 'mb-2' : ''}`}>{currentRound!.trait?.title}</h2>
              {currentRound!.trait?.description && (
                <p className="text-slate-400 text-sm leading-relaxed">{currentRound!.trait.description}</p>
              )}
            </div>

            {/* ── Live group stats ── */}
            <div className="glass rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">מצב הקבוצה</span>
                <span className="flex items-center gap-1.5 text-xs text-green-400">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-live-dot" />
                  חי
                </span>
              </div>

              {/* Highest bid banner — visible once any bid exists */}
              {roundStats.highestBid > 0 && (
                <div className={`flex items-center justify-between px-4 py-2.5 border-b border-white/10 ${
                  roundStats.isLeading
                    ? 'bg-amber-500/15 border-b border-amber-500/20'
                    : 'bg-white/[0.03]'
                }`}>
                  <span className="text-sm">
                    {roundStats.isLeading
                      ? <span className="text-amber-400 font-bold">👑 אתה/את בראש!</span>
                      : roundStats.isTiedBehind
                      ? <span className="text-amber-300 font-bold">⏱️ שוויון — מוביל מי שהציע ראשון</span>
                      : <span className="text-slate-400">הצעה גבוהה</span>}
                  </span>
                  <span className={`font-black tabular-nums text-lg ${roundStats.isLeading ? 'text-amber-400' : 'text-white'}`}>
                    {roundStats.highestBid.toLocaleString()} 🪙
                  </span>
                </div>
              )}

              {/* Three stat counters */}
              <div className="grid grid-cols-3 divide-x divide-x-reverse divide-white/10">
                {[
                  { value: roundStats.bidderCount,  label: 'הציעו',        color: 'text-green-400',  icon: '✅' },
                  { value: roundStats.noBidCount,   label: 'טרם הציעו',    color: 'text-slate-400',  icon: '⏳' },
                  { value: roundStats.foldedCount,  label: 'אין יתרה',     color: 'text-red-400',    icon: '💔' },
                ].map(s => (
                  <div key={s.label} className="flex flex-col items-center py-4 gap-0.5">
                    <span className="text-base">{s.icon}</span>
                    <span key={s.value} className={`text-2xl font-black tabular-nums ${s.color} animate-scale-in`}>{s.value}</span>
                    <span className="text-[10px] text-slate-500 text-center leading-tight">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment info */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-4 py-3 flex items-start gap-2">
              <span className="text-green-400 text-lg shrink-0">💡</span>
              <p className="text-green-300 text-sm leading-relaxed">רק <strong>הזוכה</strong> משלם את הצעתו. אם לא תזכה — המטבעות שלך נשארים אצלך.</p>
            </div>

            {/* Current bid status */}
            {myBid && (
              <div key={`bid-${myBid.amount}`} className="bg-green-500/10 border border-green-500/30 rounded-2xl px-4 py-3 flex items-center justify-between animate-scale-in">
                <span className="text-green-400 text-sm font-medium">הצעתך הנוכחית</span>
                <span className="text-green-300 font-black text-lg">{myBid.amount.toLocaleString()} 🪙</span>
              </div>
            )}

            {/* Bid form */}
            <form onSubmit={handleBidSubmit} className="flex flex-col gap-3">
              <div className="relative">
                <input
                  type="number"
                  min={myBid ? myBid.amount + 1 : 1}
                  max={participant.wallet_balance}
                  value={bidInput}
                  onChange={e => { setBidInput(e.target.value); setBidSuccess(false) }}
                  placeholder={myBid ? `מעל ${myBid.amount}` : 'סכום הצעה'}
                  disabled={bidSubmitting}
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-2xl px-5 py-4 text-2xl font-black text-center text-white focus:outline-none transition-colors placeholder:text-slate-600 disabled:opacity-50 tabular-nums"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xl">🪙</span>
              </div>

              {bidError && <p className="text-red-400 text-sm text-center animate-slide-in-up">{bidError}</p>}
              {bidSuccess && <p className="text-green-400 text-sm text-center font-bold animate-scale-in">✓ ההצעה נשלחה בהצלחה</p>}

              <button
                type="submit"
                disabled={bidSubmitting || !bidInput || parseInt(bidInput) < 1}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-slate-900 rounded-2xl py-4 text-xl font-black transition-all active:scale-95 shadow-lg shadow-amber-500/20"
              >
                {bidSubmitting ? '...' : myBid ? '⬆ העלה הצעה' : '💰 הגש הצעה'}
              </button>
            </form>

            {/* Profile link hint */}
            <p className="text-center text-slate-600 text-xs">
              <a href={`/profile?room=${encodeURIComponent(room.slug)}`} className="underline hover:text-slate-400 transition-colors">צפה בפרופיל שלך</a>
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
