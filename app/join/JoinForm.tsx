'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadParticipant, saveParticipant } from '@/lib/participant-session'

interface Props { roomId: string; roomSlug: string }

export default function JoinForm({ roomId, roomSlug }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A phone that already joined this room can go straight back to the game
  // (client-only component, so localStorage is available at first render).
  const [alreadyJoined] = useState(() => loadParticipant(roomId) !== null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/participant/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, displayName: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'שגיאה בהרשמה'); return }
      saveParticipant(roomId, roomSlug, { participantId: data.participantId, sessionToken: data.sessionToken })
      router.push(`/play?room=${encodeURIComponent(roomSlug)}`)
    } catch { setError('שגיאת רשת. נסו שוב.') }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {alreadyJoined && (
        <button
          type="button"
          onClick={() => router.push(`/play?room=${encodeURIComponent(roomSlug)}`)}
          className="w-full bg-green-600 hover:bg-green-500 text-white rounded-2xl py-3 text-base font-black transition-all active:scale-95"
        >
          כבר נרשמת מהטלפון הזה — חזרה למשחק
        </button>
      )}
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="השם שלך"
        maxLength={40}
        required
        disabled={loading}
        className="w-full bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-2xl px-5 py-4 text-xl font-bold text-center text-white focus:outline-none transition-colors placeholder:text-slate-600 disabled:opacity-50"
      />
      {error && <p className="text-red-400 text-sm text-center animate-slide-in-up">{error}</p>}
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-slate-900 rounded-2xl py-4 text-xl font-black transition-all active:scale-95 shadow-lg shadow-amber-500/20"
      >
        {loading ? 'נרשם...' : alreadyJoined ? 'הרשמה בשם אחר' : 'כניסה למשחק 🚀'}
      </button>
    </form>
  )
}
