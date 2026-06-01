'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  eventId: string
  eventSlug: string
}

export default function JoinForm({ eventId }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/participant/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, displayName: trimmed }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'שגיאה בהרשמה, נסו שוב')
        return
      }

      // Persist session token in localStorage
      localStorage.setItem('auction_session_token', data.sessionToken)
      localStorage.setItem('auction_participant_id', data.participantId)

      router.push('/play')
    } catch {
      setError('שגיאת רשת. נסו שוב.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1 text-right">
          שם התצוגה שלך
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="הכנס שם..."
          maxLength={40}
          required
          disabled={loading}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full bg-blue-700 text-white rounded-xl py-4 text-lg font-bold hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'נרשם...' : 'כניסה למשחק'}
      </button>
    </form>
  )
}
