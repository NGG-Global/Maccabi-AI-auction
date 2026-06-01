'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { Event, AuctionRound, Trait, Bid, Participant } from '@/lib/types'

interface Props {
  event: Event
  traits: Trait[]
  initialRound: AuctionRound | null
}

interface BidWithParticipant extends Bid {
  participant: Participant
}

export default function AdminDashboard({ event, traits, initialRound }: Props) {
  const [currentRound, setCurrentRound] = useState<AuctionRound | null>(initialRound)
  const [bids, setBids] = useState<BidWithParticipant[]>([])
  const [selectedTraitId, setSelectedTraitId] = useState<string>('')
  const [participantCount, setParticipantCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const supabase = createClient()

  const unusedTraits = traits.filter(t => !t.is_used)

  const fetchBids = useCallback(async (roundId: string) => {
    const { data } = await supabase
      .from('bids')
      .select('*, participant:participants(*)')
      .eq('round_id', roundId)
      .order('amount', { ascending: false })
    setBids((data ?? []) as BidWithParticipant[])
  }, [supabase])

  const fetchParticipantCount = useCallback(async () => {
    const { count } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', event.id)
    setParticipantCount(count ?? 0)
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
    setCurrentRound(round)
    if (round) fetchBids(round.id)
  }, [supabase, event.id, fetchBids])

  useEffect(() => {
    fetchParticipantCount()
    if (initialRound) fetchBids(initialRound.id)

    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
        if (currentRound) fetchBids(currentRound.id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_rounds' }, () => {
        refreshRound()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
        fetchParticipantCount()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleOpenRound() {
    if (!selectedTraitId) return
    if (currentRound?.status === 'open') {
      showMessage('error', 'יש סבב פתוח כבר. סגרו אותו קודם.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/open-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, traitId: selectedTraitId }),
      })
      const data = await res.json()
      if (!res.ok) {
        showMessage('error', data.error ?? 'שגיאה בפתיחת הסבב')
      } else {
        showMessage('success', 'הסבב נפתח!')
        setSelectedTraitId('')
        refreshRound()
      }
    } catch {
      showMessage('error', 'שגיאת רשת')
    } finally {
      setLoading(false)
    }
  }

  async function handleCloseRound() {
    if (!currentRound || currentRound.status !== 'open') return
    if (!confirm('לסגור את הסבב? כל המשתתפים ייחויבו.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/close-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId: currentRound.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        showMessage('error', data.error ?? 'שגיאה בסגירת הסבב')
      } else {
        showMessage('success', `הסבב נסגר! זוכה: ${data.winnerId ? 'יש זוכה' : 'אין הצעות'}`)
        refreshRound()
      }
    } catch {
      showMessage('error', 'שגיאת רשת')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    if (!confirm('⚠️ לאפס את כל האירוע? פעולה זו תמחק את כל המשתתפים, ההצעות והסבבים.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      })
      if (!res.ok) {
        showMessage('error', 'שגיאה באיפוס')
      } else {
        showMessage('success', 'האירוע אופס בהצלחה')
        setCurrentRound(null)
        setBids([])
        refreshRound()
        fetchParticipantCount()
      }
    } catch {
      showMessage('error', 'שגיאת רשת')
    } finally {
      setLoading(false)
    }
  }

  const avgBid = bids.length > 0 ? Math.round(bids.reduce((s, b) => s + b.amount, 0) / bids.length) : 0
  const totalBid = bids.reduce((s, b) => s + b.amount, 0)

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gray-900 text-white rounded-2xl p-6 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">לוח בקרה — מנהל</h1>
            <p className="text-gray-400 text-sm mt-1">{event.name}</p>
          </div>
          <div className="text-left">
            <p className="text-gray-400 text-xs">משתתפים</p>
            <p className="text-3xl font-bold">{participantCount}</p>
          </div>
        </div>

        {message && (
          <div className={`rounded-xl p-4 mb-4 font-semibold text-center ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {/* Round status */}
        <div className="bg-white rounded-2xl p-6 mb-4 shadow">
          <h2 className="text-lg font-bold text-gray-700 mb-4">סטטוס סבב נוכחי</h2>

          {!currentRound && (
            <p className="text-gray-400">אין סבב פעיל כרגע.</p>
          )}

          {currentRound && (
            <div className="flex gap-4 items-start flex-wrap">
              <div className="flex-1">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold mb-2 ${
                  currentRound.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {currentRound.status === 'open' ? 'פתוח' : 'סגור'}
                </span>
                <p className="font-bold text-xl">{currentRound.trait?.title}</p>
                <p className="text-gray-500 text-sm">{currentRound.trait?.description}</p>

                {currentRound.status === 'closed' && currentRound.winner && (
                  <div className="mt-3 bg-yellow-50 border border-yellow-300 rounded-xl p-3">
                    <p className="font-bold text-yellow-800">🏆 זוכה: {(currentRound.winner as Participant).display_name}</p>
                    <p className="text-yellow-700 text-sm">הצעה: {currentRound.winning_bid_amount} מטבעות</p>
                  </div>
                )}
              </div>

              <div className="text-left text-sm text-gray-500 space-y-1">
                <p>הצעות: <span className="font-bold text-gray-800">{bids.length}</span></p>
                <p>גבוה ביותר: <span className="font-bold text-gray-800">{bids[0]?.amount ?? 0}</span></p>
                <p>ממוצע: <span className="font-bold text-gray-800">{avgBid}</span></p>
                <p>סה"כ הוצאה: <span className="font-bold text-gray-800">{totalBid}</span></p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl p-6 mb-4 shadow">
          <h2 className="text-lg font-bold text-gray-700 mb-4">בקרת סבב</h2>

          <div className="flex gap-3 flex-wrap mb-4">
            <select
              value={selectedTraitId}
              onChange={e => setSelectedTraitId(e.target.value)}
              disabled={loading || currentRound?.status === 'open'}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">בחר תכונה לסבב הבא</option>
              {unusedTraits.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>

            <button
              onClick={handleOpenRound}
              disabled={loading || !selectedTraitId || currentRound?.status === 'open'}
              className="bg-green-600 text-white rounded-xl px-6 py-3 font-bold hover:bg-green-700 disabled:opacity-50"
            >
              פתח סבב
            </button>
          </div>

          {currentRound?.status === 'open' && (
            <button
              onClick={handleCloseRound}
              disabled={loading}
              className="w-full bg-red-600 text-white rounded-xl py-4 text-lg font-bold hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'סוגר...' : '⏹ סגור סבב וחשב תוצאות'}
            </button>
          )}
        </div>

        {/* Bids table */}
        {bids.length > 0 && (
          <div className="bg-white rounded-2xl p-6 mb-4 shadow">
            <h2 className="text-lg font-bold text-gray-700 mb-4">הצעות ({bids.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b">
                    <th className="text-right pb-2">משתתף</th>
                    <th className="text-right pb-2">הצעה</th>
                    <th className="text-right pb-2">זמן עדכון</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid, i) => (
                    <tr key={bid.id} className={`border-b ${i === 0 ? 'bg-yellow-50 font-bold' : ''}`}>
                      <td className="py-2">{bid.participant?.display_name}</td>
                      <td className="py-2">{bid.amount} 🪙</td>
                      <td className="py-2 text-gray-400 text-xs">
                        {new Date(bid.updated_at).toLocaleTimeString('he-IL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Traits list */}
        <div className="bg-white rounded-2xl p-6 mb-4 shadow">
          <h2 className="text-lg font-bold text-gray-700 mb-4">תכונות ({traits.length})</h2>
          <div className="grid gap-2">
            {traits.map(t => (
              <div key={t.id} className={`flex justify-between items-center p-3 rounded-xl ${t.is_used ? 'bg-gray-100 text-gray-400' : 'bg-blue-50'}`}>
                <span className={t.is_used ? 'line-through' : 'font-medium'}>{t.title}</span>
                {t.is_used && <span className="text-xs text-gray-400">שימש</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Reset */}
        <div className="bg-white rounded-2xl p-6 shadow border border-red-200">
          <h2 className="text-lg font-bold text-red-700 mb-2">איפוס לחזרה</h2>
          <p className="text-gray-500 text-sm mb-4">מחיקת כל המשתתפים, הצעות וסבבים. לשימוש לפני האירוע האמיתי.</p>
          <button
            onClick={handleReset}
            disabled={loading}
            className="bg-red-600 text-white rounded-xl px-6 py-3 font-bold hover:bg-red-700 disabled:opacity-50"
          >
            אפס אירוע
          </button>
        </div>
      </div>
    </main>
  )
}
