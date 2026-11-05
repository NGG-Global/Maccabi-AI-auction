'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RoomStatus } from '@/lib/types'
import StatusPill from '@/components/game/StatusPill'
import { Button, ErrorText } from '@/components/game/ui'

interface Props {
  roomId: string
  status: RoomStatus
  activeUntil: string | null
}

function hhmm(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        {live && until ? (
          <StatusPill kind="live">חי · עד {hhmm(until)}</StatusPill>
        ) : status === 'archived' ? (
          <StatusPill kind="archived">בארכיון</StatusPill>
        ) : status === 'ended' ? (
          <StatusPill kind="ended">הסתיים</StatusPill>
        ) : (
          <StatusPill kind="expired">לא פעיל</StatusPill>
        )}
        {live && (
          <span className="text-[12px] text-ink-3">
            נשארו {hours > 0 ? `${hours} שע׳ ו־` : ''}{minutes} דק׳
          </span>
        )}
      </div>
      {status !== 'archived' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setStatus('active')} disabled={busy} className="flex-1">
            {live ? 'הארכה ל־12 שעות' : 'הפעלה ל־12 שעות'}
          </Button>
          {live && !confirmEnd && (
            <Button size="sm" onClick={() => setConfirmEnd(true)} disabled={busy}>סיום</Button>
          )}
          {live && confirmEnd && (
            <Button variant="primary" size="sm" onClick={() => setStatus('ended')} disabled={busy}>אישור הסיום</Button>
          )}
        </div>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  )
}
