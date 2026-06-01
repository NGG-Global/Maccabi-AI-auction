'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { Participant, AuctionRound, Bid } from '@/lib/types'

interface RoundWithBid { round: AuctionRound; bid: Bid; won: boolean }

function getArchetype(rounds: RoundWithBid[]): { title: string; desc: string; icon: string } {
  const categorySpend: Record<string, number> = {}
  for (const r of rounds) {
    const cat = (r.round.trait as any)?.category ?? 'אחר'
    categorySpend[cat] = (categorySpend[cat] ?? 0) + r.bid.amount
  }
  const top = Object.entries(categorySpend).sort((a, b) => b[1] - a[1])[0]?.[0]
  const archetypes: Record<string, { title: string; desc: string; icon: string }> = {
    'יחסים':   { title: 'מנהל יחסים', desc: 'את/ה משקיע/ה בקשרים האנושיים ובאמון.', icon: '🤝' },
    'מנהיגות': { title: 'מנהיג חזון', desc: 'את/ה מוביל/ה עם השראה ואומץ.', icon: '🌟' },
    'שיפוט':   { title: 'מקבל החלטות', desc: 'את/ה מצטיין/ת בשיקול דעת בתנאי אי-ודאות.', icon: '⚖️' },
    'למידה':   { title: 'מנהל צמיחה', desc: 'את/ה משקיע/ה בלמידה ובהתפתחות מתמדת.', icon: '🌱' },
  }
  return archetypes[top ?? ''] ?? { title: 'מנהל מאוזן', desc: 'את/ה מפזר/ת את ההשקעה על פני מגוון תכונות.', icon: '✨' }
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
      if (!participantId) { setError('לא נמצאו פרטי משתתף.'); setLoading(false); return }
      const { data: p } = await supabase.from('participants').select('*').eq('id', participantId).single<Participant>()
      if (!p) { setError('המשתתף לא נמצא.'); setLoading(false); return }
      setParticipant(p)
      const { data: bids } = await supabase
        .from('bids')
        .select('*, round:auction_rounds(*, trait:traits(*))')
        .eq('participant_id', participantId)
      const rnd: RoundWithBid[] = (bids ?? [])
        .map((b: Bid & { round: AuctionRound }) => ({ round: b.round, bid: b, won: b.round.winner_participant_id === participantId }))
        .filter(r => r.round.status === 'closed')
      setRounds(rnd)
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
    </main>
  )
  if (error || !participant) return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="glass rounded-3xl p-8 text-center"><p className="text-red-400 text-lg">{error}</p></div>
    </main>
  )

  const totalSpent = 1000 - participant.wallet_balance
  const won = rounds.filter(r => r.won)
  const lost = rounds.filter(r => !r.won)
  const archetype = rounds.length > 0 ? getArchetype(rounds) : null

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-4">

        {/* Header */}
        <div className="text-center animate-slide-in-up">
          <div className="text-5xl mb-3">👤</div>
          <h1 className="text-3xl font-black text-white mb-1">{participant.display_name}</h1>
          <p className="text-slate-500 text-sm">פרופיל מנהל אישי</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 animate-slide-in-up" style={{ animationDelay: '80ms' }}>
          {[
            { label: 'יתרה', value: participant.wallet_balance.toLocaleString(), color: 'text-green-400' },
            { label: 'הוצאה', value: totalSpent.toLocaleString(), color: 'text-red-400' },
            { label: 'זכיות', value: won.length, color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="glass rounded-2xl p-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Archetype */}
        {archetype && (
          <div className="bg-gradient-to-br from-blue-950 to-slate-900 border border-blue-500/30 rounded-3xl p-6 animate-scale-in" style={{ animationDelay: '160ms' }}>
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-3">הפרופיל שלך</p>
            <div className="flex items-center gap-4">
              <span className="text-5xl">{archetype.icon}</span>
              <div>
                <p className="text-white text-xl font-black">{archetype.title}</p>
                <p className="text-slate-400 text-sm mt-1">{archetype.desc}</p>
              </div>
            </div>
          </div>
        )}

        {/* Won traits */}
        {won.length > 0 && (
          <div className="animate-slide-in-up" style={{ animationDelay: '200ms' }}>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-3">🏆 תכונות שרכשת</p>
            <div className="flex flex-col gap-2">
              {won.map(r => (
                <div key={r.round.id} className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold">{(r.round.trait as any)?.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{(r.round.trait as any)?.description}</p>
                  </div>
                  <span className="text-amber-400 font-black text-sm shrink-0 mr-3">{r.bid.amount} 🪙</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lost bids */}
        {lost.length > 0 && (
          <div className="animate-slide-in-up" style={{ animationDelay: '260ms' }}>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-3">💸 הצעות שלא זכו</p>
            <div className="flex flex-col gap-2">
              {lost.map(r => (
                <div key={r.round.id} className="glass rounded-2xl p-4 flex items-center justify-between">
                  <p className="text-slate-300 font-medium">{(r.round.trait as any)?.title}</p>
                  <span className="text-red-400 font-black text-sm shrink-0 mr-3">{r.bid.amount} 🪙</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {rounds.length === 0 && (
          <div className="glass rounded-3xl p-8 text-center animate-fade-in">
            <p className="text-slate-500">לא השתתפת בסבבים עדיין.</p>
          </div>
        )}
      </div>
    </main>
  )
}
