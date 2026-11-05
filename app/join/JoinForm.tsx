'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadParticipant, saveParticipant } from '@/lib/participant-session'
import { CTA, ErrorText, FIELD, btnClass } from '@/components/game/ui'

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
          className={btnClass('secondary', 'md', 'h-14 w-full text-[17px]')}
        >
          כבר נרשמתם מהטלפון הזה. חזרה למכירה
        </button>
      )}
      <label className="flex flex-col gap-2 text-[14px] font-semibold text-ink-2">
        השם שלכם
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="כפי שיופיע על המסך"
          maxLength={40}
          required
          disabled={loading}
          autoComplete="name"
          className={`${FIELD} h-14 text-center text-[20px] font-semibold shadow-piece-sm`}
        />
      </label>
      {error && <ErrorText>{error}</ErrorText>}
      <button type="submit" disabled={loading || !name.trim()} className={CTA}>
        {loading ? 'נרשמים…' : alreadyJoined ? 'הרשמה בשם אחר' : 'כניסה למכירה'}
      </button>
    </form>
  )
}
