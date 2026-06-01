'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { Event, AuctionRound, Participant } from '@/lib/types'

interface Props {
  event: Event
}

interface ScreenState {
  round: AuctionRound | null
  bidderCount: number
  highestBid: number
  winner: Participant | null
}

export default function ScreenClient({ event }: Props) {
  const [state, setState] = useState<ScreenState>({
    round: null,
    bidderCount: 0,
    highestBid: 0,
    winner: null,
  })
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

    let bidderCount = 0
    let highestBid = 0

    if (round) {
      const { data: bids } = await supabase
        .from('bids')
        .select('amount')
        .eq('round_id', round.id)

      bidderCount = bids?.length ?? 0
      highestBid = bids?.reduce((max, b) => Math.max(max, b.amount), 0) ?? 0
    }

    const { count } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', event.id)

    setParticipantCount(count ?? 0)
    setState({
      round,
      bidderCount,
      highestBid,
      winner: round?.winner as Participant | null ?? null,
    })
  }, [supabase, event.id])

  useEffect(() => {
    fetchState()

    const channel = supabase
      .channel('screen-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_rounds' }, fetchState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, fetchState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, fetchState)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchState, supabase])

  const { round, bidderCount, highestBid, winner } = state

  // Waiting state
  if (!round) {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-6xl font-black mb-4">מכירה פומבית</h1>
          <h2 className="text-3xl font-light text-blue-300 mb-12">תכונות ניהוליות</h2>
          <div className="bg-white/10 rounded-3xl px-12 py-8">
            <p className="text-2xl text-gray-300 mb-2">ממתינים להתחיל...</p>
            <p className="text-4xl font-bold">{participantCount} משתתפים</p>
          </div>
        </div>
      </main>
    )
  }

  // Winner reveal
  if (round.status === 'closed') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-yellow-500 to-orange-600 flex flex-col items-center justify-center text-white">
        <div className="text-center px-12">
          <p className="text-3xl font-light mb-4 opacity-80">התכונה — {round.trait?.title}</p>

          {winner ? (
            <>
              <div className="text-8xl mb-6">🏆</div>
              <h1 className="text-7xl font-black mb-4">{winner.display_name}</h1>
              <p className="text-4xl font-bold opacity-90 mb-8">{round.winning_bid_amount?.toLocaleString()} מטבעות</p>
            </>
          ) : (
            <>
              <div className="text-8xl mb-6">🤷</div>
              <h1 className="text-5xl font-bold mb-4">לא הוגשו הצעות</h1>
            </>
          )}

          <div className="bg-white/20 rounded-3xl px-12 py-6 grid grid-cols-3 gap-8 text-center mt-4">
            <div>
              <p className="text-xl opacity-70">מציעים</p>
              <p className="text-5xl font-bold">{bidderCount}</p>
            </div>
            <div>
              <p className="text-xl opacity-70">הצעה גבוהה</p>
              <p className="text-5xl font-bold">{highestBid.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xl opacity-70">סה"כ הוצאה</p>
              <p className="text-5xl font-bold">
                {/* sum all bids — displayed via bidderCount * avg approximation; real sum needs extra fetch */}
                —
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Open round
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-700 flex flex-col items-center justify-center text-white px-12">
      <div className="text-center max-w-4xl">
        <p className="text-2xl uppercase tracking-widest opacity-60 mb-6">מתמודדים עכשיו</p>
        <h1 className="text-8xl font-black mb-6">{round.trait?.title}</h1>
        <p className="text-3xl font-light opacity-80 mb-16 leading-relaxed">{round.trait?.description}</p>

        <div className="grid grid-cols-2 gap-8">
          <div className="bg-white/10 rounded-3xl px-10 py-8">
            <p className="text-2xl opacity-60 mb-2">משתתפים הגישו הצעה</p>
            <p className="text-7xl font-bold">{bidderCount}</p>
          </div>
          <div className="bg-white/10 rounded-3xl px-10 py-8">
            <p className="text-2xl opacity-60 mb-2">הצעה גבוהה ביותר</p>
            <p className="text-7xl font-bold">{highestBid > 0 ? highestBid.toLocaleString() : '—'}</p>
          </div>
        </div>
      </div>
    </main>
  )
}
