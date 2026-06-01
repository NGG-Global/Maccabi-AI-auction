'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { Participant, AuctionRound, Bid } from '@/lib/types'

interface RoundWithBid {
  round: AuctionRound
  bid: Bid
  won: boolean
}

export default function ProfileClient() {
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [rounds, setRounds] = useState<RoundWithBid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const participantId = localStorage.getItem('auction_participant_id')
      if (!participantId) {
        setError('לא נמצאו פרטי משתתף. חזרו לדף הכניסה.')
        setLoading(false)
        return
      }

      const { data: p } = await supabase
        .from('participants')
        .select('*')
        .eq('id', participantId)
        .single<Participant>()

      if (!p) {
        setError('המשתתף לא נמצא.')
        setLoading(false)
        return
      }

      setParticipant(p)

      // Fetch all bids by this participant
      const { data: bids } = await supabase
        .from('bids')
        .select('*, round:auction_rounds(*, trait:traits(*))')
        .eq('participant_id', participantId)

      const roundsWithBids: RoundWithBid[] = (bids ?? []).map((b: Bid & { round: AuctionRound }) => ({
        round: b.round,
        bid: b,
        won: b.round.winner_participant_id === participantId,
      }))

      setRounds(roundsWithBids.filter(r => r.round.status === 'closed'))
      setLoading(false)
    }
    load()
  }, [supabase])

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
        <div className="bg-white rounded-2xl p-8 text-center">
          <p className="text-red-600 text-lg">{error}</p>
          <a href="/" className="block mt-4 text-blue-600 underline">חזרה לדף הכניסה</a>
        </div>
      </main>
    )
  }

  const totalSpent = 1000 - participant.wallet_balance
  const traitsWon = rounds.filter(r => r.won)
  const traitsBidLost = rounds.filter(r => !r.won)

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-700 px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl p-8 mb-6 text-center shadow-2xl">
          <h1 className="text-3xl font-black text-blue-900 mb-1">{participant.display_name}</h1>
          <p className="text-gray-500 mb-6">פרופיל מנהל אישי</p>

          <div className="grid grid-cols-3 gap-4 mb-6 text-center">
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">יתרה נותרת</p>
              <p className="text-2xl font-bold text-blue-700">{participant.wallet_balance}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">הוצאה כוללת</p>
              <p className="text-2xl font-bold text-red-600">{totalSpent}</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">זכיות</p>
              <p className="text-2xl font-bold text-yellow-600">{traitsWon.length}</p>
            </div>
          </div>
        </div>

        {traitsWon.length > 0 && (
          <div className="bg-white rounded-2xl p-6 mb-4 shadow">
            <h2 className="text-lg font-bold text-yellow-700 mb-4">🏆 תכונות שרכשת</h2>
            <div className="flex flex-col gap-3">
              {traitsWon.map(r => (
                <div key={r.round.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="font-bold text-gray-800">{r.round.trait?.title}</p>
                  <p className="text-sm text-gray-500">{r.round.trait?.description}</p>
                  <p className="text-sm font-semibold text-yellow-700 mt-1">{r.bid.amount} מטבעות</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {traitsBidLost.length > 0 && (
          <div className="bg-white rounded-2xl p-6 mb-4 shadow">
            <h2 className="text-lg font-bold text-gray-600 mb-4">💸 הצעות שלא זכו</h2>
            <div className="flex flex-col gap-3">
              {traitsBidLost.map(r => (
                <div key={r.round.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="font-bold text-gray-700">{r.round.trait?.title}</p>
                  <p className="text-sm font-semibold text-red-500 mt-1">שילמת {r.bid.amount} מטבעות</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {rounds.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center shadow">
            <p className="text-gray-500">לא השתתפת בסבבים עדיין.</p>
          </div>
        )}
      </div>
    </main>
  )
}
