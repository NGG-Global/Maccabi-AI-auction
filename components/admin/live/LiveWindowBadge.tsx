'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RoomStatus } from '@/lib/types'

interface Props {
  roomId: string
  status: RoomStatus
  activeUntil: string | null
}

/**
 * Shows how long the room's live window has left (12 hours from the last
 * activation) with a one-click way to extend it, and a way to end the room.
 * Participants can join and bid only while the window is open.
 */
export default function LiveWindowBadge({ roomId, status, activeUntil }: Props) {
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const until = activeUntil ? new Date(activeUntil).getTime() : null
  const live = status === 'active' && until !== null && until > now
  const leftMs = live && until ? until - now : 0
  const hours = Math.floor(leftMs / 3_600_000)
  const minutes = Math.floor((leftMs % 3_600_000) / 60_000)

  async function setStatus(next: 'active' | 'ended') {
    setBusy(true)
    setError(null)
    setConfirmEnd(false)
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'שגיאה'); return }
      router.refresh()
    } catch { setError('שגיאת רשת') }
    finally { setBusy(false) }
  }

  return (
    <div className={`rounded-xl px-3 py-2 text-xs flex flex-col gap-1.5 border ${
      live ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`font-bold ${live ? 'text-green-400' : 'text-red-400'}`}>
          {live
            ? `🟢 חדר פעיל · נותרו ${hours > 0 ? `${hours} שע׳ ו-` : ''}${minutes} דק׳`
            : status === 'archived' ? '📦 בארכיון' : status === 'ended' ? '⏹ החדר הסתיים' : '🔴 החדר אינו פעיל'}
        </span>
      </div>
      {status !== 'archived' && (
        <div className="flex gap-1.5">
          <button
            onClick={() => setStatus('active')}
            disabled={busy}
            className="flex-1 bg-green-700/70 hover:bg-green-600 disabled:opacity-40 text-white rounded-lg py-1.5 font-bold transition-all"
          >
            {live ? 'הארך ל-12 שעות' : 'הפעל חדר (12 שעות)'}
          </button>
          {live && !confirmEnd && (
            <button
              onClick={() => setConfirmEnd(true)}
              disabled={busy}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 rounded-lg px-3 py-1.5 font-medium transition-all"
            >
              סיים
            </button>
          )}
          {live && confirmEnd && (
            <button
              onClick={() => setStatus('ended')}
              disabled={busy}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 font-bold transition-all"
            >
              אשר סיום
            </button>
          )}
        </div>
      )}
      {error && <p className="text-red-400">{error}</p>}
    </div>
  )
}
