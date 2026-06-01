'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { Event, AuctionRound, Participant } from '@/lib/types'

interface Props { event: Event }

interface ScreenState {
  round: AuctionRound | null
  bidderCount: number
  highestBid: number
  totalSpent: number
  winner: Participant | null
}

export default function ScreenClient({ event }: Props) {
  const [state, setState] = useState<ScreenState>({ round: null, bidderCount: 0, highestBid: 0, totalSpent: 0, winner: null })
  const [participantCount, setParticipantCount] = useState(0)
  const supabase = createClient()

  const fetchState = useCallback(async () => {
    const { data: rounds } = await supabase
      .from('auction_rounds')
      .select('*, trait:traits(*), winner:participants!auction_rounds_winner_participant_id_fkey(*)')
      .eq('event_id', event.id)
      .in('status', ['open', 'closed'])
      .order('created_at', { ascending: false })
      .limit(1)

    const round = (rounds?.[0] ?? null) as AuctionRound | null
    let bidderCount = 0, highestBid = 0, totalSpent = 0

    if (round) {
      const { data: bids } = await supabase.from('bids').select('amount').eq('round_id', round.id)
      bidderCount = bids?.length ?? 0
      highestBid = bids?.reduce((m, b) => Math.max(m, b.amount), 0) ?? 0
      totalSpent = bids?.reduce((s, b) => s + b.amount, 0) ?? 0
    }

    const { count } = await supabase.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', event.id)
    setParticipantCount(count ?? 0)
    setState({ round, bidderCount, highestBid, totalSpent, winner: round?.winner as Participant | null ?? null })
  }, [supabase, event.id])

  useEffect(() => {
    fetchState()
    const channel = supabase.channel('screen-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_rounds' }, fetchState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, fetchState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, fetchState)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchState, supabase])

  const { round, bidderCount, highestBid, totalSpent, winner } = state

  /* ── Waiting ── */
  if (!round) return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
      <div className="text-center animate-fade-in">
        <div className="text-[120px] leading-none mb-8 animate-float">🏆</div>
        <h1 className="text-7xl font-black text-white mb-4">מכירה פומבית</h1>
        <p className="text-3xl text-amber-400 font-semibold mb-12">תכונות ניהוליות</p>
        <div className="glass rounded-3xl px-16 py-8 inline-block">
          <p className="text-slate-400 text-xl mb-1">משתתפים רשומים</p>
          <p className="text-6xl font-black text-white">{participantCount}</p>
        </div>
      </div>
    </main>
  )

  /* ── Winner reveal ── */
  if (round.status === 'closed') return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-amber-950/30 to-slate-950 flex flex-col items-center justify-center px-8 overflow-hidden">

      <div className="text-center max-w-4xl w-full">
        <p className="text-slate-500 text-xl uppercase tracking-widest mb-2 animate-fade-in">{round.trait?.title}</p>

        {winner ? (
          <div className="animate-winner-reveal animate-pulse-gold">
            <div className="text-[100px] leading-none mb-4">👑</div>
            <p className="text-slate-400 text-2xl mb-2">הזוכה הוא</p>
            <h1 className="text-8xl font-black mb-6 shimmer-gold">{winner.display_name}</h1>
            <p className="text-6xl font-black text-amber-400">{round.winning_bid_amount?.toLocaleString()} 🪙</p>
          </div>
        ) : (
          <div className="animate-scale-in">
            <div className="text-[80px] leading-none mb-6">🤷</div>
            <h1 className="text-6xl font-black text-slate-400">לא הוגשו הצעות</h1>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-6 mt-12 animate-slide-in-up" style={{ animationDelay: '400ms' }}>
          {[
            { label: 'מציעים', value: bidderCount, color: 'text-blue-400' },
            { label: 'הצעה גבוהה', value: `${highestBid.toLocaleString()} 🪙`, color: 'text-amber-400' },
            { label: 'סה"כ הוצאה', value: `${totalSpent.toLocaleString()} 🪙`, color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="glass rounded-3xl py-8 px-6">
              <p className="text-slate-500 text-lg mb-2">{s.label}</p>
              <p className={`text-5xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )

  /* ── Open round ── */
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-950 via-slate-950 to-slate-950 flex flex-col items-center justify-center px-12 overflow-hidden">
      <div className="text-center max-w-4xl w-full">
        <div className="flex items-center justify-center gap-3 mb-8 animate-fade-in">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-live-dot" />
          <span className="text-red-400 text-xl font-bold uppercase tracking-widest">סבב פתוח</span>
        </div>

        <p className="text-slate-500 text-2xl uppercase tracking-widest mb-4 animate-fade-in">מתמודדים עכשיו</p>
        <h1 key={round.id} className="text-[96px] font-black text-white leading-none mb-6 animate-scale-in">
          {round.trait?.title}
        </h1>
        <p className="text-slate-400 text-2xl leading-relaxed mb-16 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '100ms' }}>
          {round.trait?.description}
        </p>

        <div className="grid grid-cols-2 gap-8 animate-slide-in-up" style={{ animationDelay: '200ms' }}>
          <div className="glass rounded-3xl py-10 px-8">
            <p className="text-slate-500 text-xl mb-2">משתתפים הגישו הצעה</p>
            <p className="text-7xl font-black text-blue-400">{bidderCount}</p>
          </div>
          <div className="glass rounded-3xl py-10 px-8">
            <p className="text-slate-500 text-xl mb-2">הצעה גבוהה ביותר</p>
            <p className="text-7xl font-black text-amber-400">{highestBid > 0 ? highestBid.toLocaleString() : '—'}</p>
          </div>
        </div>
      </div>
    </main>
  )
}
