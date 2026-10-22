'use client'

import { useState } from 'react'

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
      <button
        onClick={() => setConfirming(true)}
        disabled={disabled || busy}
        className="w-full bg-transparent hover:bg-red-900/30 border border-red-900/50 text-red-500 hover:text-red-400 rounded-xl py-2.5 text-xs font-medium transition-all"
      >
        {busy ? '...' : '🔄 איפוס החדר'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 animate-scale-in bg-red-950/40 border border-red-700/50 rounded-xl p-3">
      <p className="text-red-400 text-xs font-bold text-center">⚠️ איפוס החדר הזה בלבד</p>
      <p className="text-slate-400 text-[11px] text-center leading-relaxed">
        ימחקו כל המשתתפים, ההצעות והסבבים של החדר. ההגדרות וההיגדים נשמרים. פעולה זו אינה הפיכה.
      </p>
      <div className="flex gap-2 mt-1">
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-2 text-xs font-medium transition-all"
        >
          ביטול
        </button>
        <button
          onClick={handleReset}
          disabled={disabled || busy}
          className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg py-2 text-xs font-bold transition-all"
        >
          אשר איפוס
        </button>
      </div>
    </div>
  )
}
