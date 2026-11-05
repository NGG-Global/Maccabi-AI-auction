'use client'

import { useState } from 'react'
import { Button } from '@/components/game/ui'

interface Props {
  roomId: string
  disabled: boolean
  onReset: () => void | Promise<void>
  onError: (text: string) => void
}

/** Two-step "reset room" control: deletes this room's participants, bids and rounds. Other rooms are untouched. */
export default function ResetControl({ roomId, disabled, onReset, onError }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleReset() {
    setConfirming(false)
    setBusy(true)
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        onError(data.error ?? 'שגיאה באיפוס')
        return
      }
      await onReset()
    } catch { onError('שגיאת רשת') }
    finally { setBusy(false) }
  }

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)} disabled={disabled || busy} className="w-full">
        {busy ? 'מאפסים…' : 'איפוס הסשן'}
      </Button>
    )
  }

  return (
    <div className="gm-rise flex flex-col gap-2 rounded-[12px] border-2 border-error bg-error-tint p-3">
      <p className="m-0 text-[14px] font-bold text-error">איפוס הסשן</p>
      <p className="m-0 text-[13px] leading-relaxed text-ink-2">
        מוחק את המשתתפים וההצעות של הסשן הזה בלבד. ההגדרות והפריטים נשמרים. אי אפשר לבטל.
      </p>
      <div className="mt-1 flex gap-2">
        <Button size="sm" onClick={() => setConfirming(false)} className="flex-1">ביטול</Button>
        <Button variant="primary" size="sm" onClick={handleReset} disabled={disabled || busy} className="flex-1">אישור האיפוס</Button>
      </div>
    </div>
  )
}
