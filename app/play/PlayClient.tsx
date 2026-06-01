'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { AuctionRound, Participant, Bid } from '@/lib/types'

interface GameState {
  participant: Participant | null
  currentRound: AuctionRound | null
  myBid: Bid | null
  loading: boolean
  error: string | null
}

export default function PlayClient() {
  const [state, setState] = useState<GameState>({
    participant: null,
    currentRound: null,
    myBid: null,
    loading: true,
    error: null,
  })
  const [bidInput, setBidInput] = useState('')
  const [bidSubmitting, setBidSubmitting] = useState(false)
  const [bidError, setBidError] = useState<string | null>(null)
  const [bidSuccess, setBidSuccess] = useState(false)

  const supabase = createClient()

  const fetchState = useCallback(async (participantId: string) => {
    // Fetch participant
    const { data: participant } = await supabase
      .from('participants')
      .select('*')
      .eq('id', participantId)
      .single<Participant>()

    if (!participant) return

    // Fetch current open/closed round for the event
    const { data: rounds } = await supabase
      .from('auction_rounds')
      .select('*, trait:traits(*), winner:participants!auction_rounds_winner_participant_id_fkey(*)')
      .eq('event_id', participant.event_id)
      .in('status', ['open', 'closed'])
      .order('created_at', { ascending: false })
      .limit(1)

    const round = (rounds?.[0] ?? null) as AuctionRound | null

    // Fetch my bid for current round
    let myBid: Bid | null = null
    if (round) {
      const { data: bid } = await supabase
        .from('bids')
        .select('*')
        .eq('round_id', round.id)
        .eq('participant_id', participantId)
        .maybeSingle<Bid>()
      myBid = bid ?? null
    }

    setState(prev => ({ ...prev, participant, currentRound: round, myBid, loading: false }))
  }, [supabase])

  useEffect(() => {
    const participantId = localStorage.getItem('auction_participant_id')
    if (!participantId) {
      setState(prev => ({ ...prev, loading: false, error: 'לא נמצא פרטי משתתף. סרקו את קוד ה-QR מחדש.' }))
      return
    }

    fetchState(participantId)

    // Subscribe to round changes
    const channel = supabase
      .channel('play-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_rounds' }, () => {
        fetchState(participantId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
        fetchState(participantId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, (payload) => {
        if ((payload.new as Participant)?.id === participantId) {
          fetchState(participantId)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchState, supabase])

  async function handleBidSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseInt(bidInput, 10)
    if (isNaN(amount)) return

    setBidSubmitting(true)
    setBidError(null)
    setBidSuccess(false)

    const sessionToken = localStorage.getItem('auction_session_token')

    try {
      const res = await fetch('/api/bid/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, roundId: state.currentRound?.id, amount }),
      })
      const data = await res.json()

      if (!res.ok) {
        setBidError(data.error ?? 'שגיאה בהגשת ההצעה')
      } else {
        setBidSuccess(true)
        setBidInput('')
        // Refresh state
        const participantId = localStorage.getItem('auction_participant_id')
        if (participantId) fetchState(participantId)
      }
    } catch {
      setBidError('שגיאת רשת. נסו שוב.')
    } finally {
      setBidSubmitting(false)
    }
  }

  const { participant, currentRound, myBid, loading, error } = state

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-blue-900">
        <p className="text-white text-xl">טוען...</p>
      </main>
    )
  }

  if (error || !participant) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-blue-900 px-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
          <p className="text-red-600 text-lg font-semibold">{error ?? 'שגיאה לא צפויה'}</p>
          <a href="/" className="block mt-4 text-blue-600 underline">חזרה לדף הכניסה</a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-700 px-4 py-6 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-md bg-white/10 rounded-2xl p-4 mb-6 flex justify-between items-center text-white">
        <span className="text-lg font-bold">{participant.display_name}</span>
        <div className="text-left">
          <p className="text-xs opacity-70">יתרה</p>
          <p className="text-2xl font-bold">{participant.wallet_balance.toLocaleString()} 🪙</p>
        </div>
      </div>

      {/* No active round */}
      {!currentRound || currentRound.status === 'closed' && (
        <div className="w-full max-w-md bg-white rounded-2xl p-8 text-center shadow-xl">
          {currentRound?.status === 'closed' ? (
            <>
              <p className="text-2xl font-bold text-gray-800 mb-2">הסבב הסתיים</p>
              <p className="text-gray-500 mb-4">
                {currentRound.winner_participant_id === participant.id
                  ? '🏆 זכית בסבב הזה!'
                  : myBid
                  ? `הצעתך הייתה ${myBid.amount} מטבעות.`
                  : 'לא הגשת הצעה בסבב זה.'}
              </p>
              {myBid && (
                <p className="text-red-600 font-semibold">
                  נוכו {myBid.amount} מטבעות מהיתרה שלך.
                </p>
              )}
              <p className="text-gray-400 mt-6 text-sm">ממתין לסבב הבא...</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-800 mb-2">ממתינים להתחלה</p>
              <p className="text-gray-500">הסבב הבא יתחיל בקרוב.</p>
            </>
          )}
        </div>
      )}

      {/* Active round */}
      {currentRound?.status === 'open' && (
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-blue-700 text-white p-4 text-center">
            <p className="text-xs uppercase tracking-wider opacity-70 mb-1">סבב פתוח — מתמודדים עכשיו</p>
            <h2 className="text-2xl font-bold">{currentRound.trait?.title}</h2>
          </div>
          <div className="p-6">
            <p className="text-gray-600 text-sm leading-6 mb-4">{currentRound.trait?.description}</p>

            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-6 text-sm text-amber-800 font-medium">
              ⚠️ ההצעה הסופית שלך תנוכה מהיתרה — גם אם לא תזכה.
            </div>

            {myBid && (
              <div className="bg-green-50 border border-green-300 rounded-xl p-3 mb-4 text-sm text-green-800">
                הצעתך הנוכחית: <span className="font-bold">{myBid.amount} מטבעות</span>
              </div>
            )}

            <form onSubmit={handleBidSubmit} className="flex flex-col gap-3">
              <input
                type="number"
                min={myBid ? myBid.amount + 1 : 1}
                max={participant.wallet_balance}
                value={bidInput}
                onChange={e => { setBidInput(e.target.value); setBidSuccess(false) }}
                placeholder={myBid ? `הגש הצעה גבוהה מ-${myBid.amount}` : 'הגש הצעה'}
                disabled={bidSubmitting}
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-xl text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />

              {bidError && <p className="text-red-600 text-sm text-center">{bidError}</p>}
              {bidSuccess && <p className="text-green-600 text-sm text-center font-semibold">ההצעה נשלחה!</p>}

              <button
                type="submit"
                disabled={bidSubmitting || !bidInput}
                className="w-full bg-blue-700 text-white rounded-xl py-4 text-lg font-bold hover:bg-blue-800 transition-colors disabled:opacity-50"
              >
                {bidSubmitting ? 'שולח...' : myBid ? 'העלה הצעה' : 'הגש הצעה'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
