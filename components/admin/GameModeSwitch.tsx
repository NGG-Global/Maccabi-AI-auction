'use client'

import { useState } from 'react'
import type { GameMode } from '@/lib/types'

interface Props {
  eventId: string
  mode: GameMode
  /** True once any round exists — the mode is then fixed until a reset. */
  locked: boolean
  onChange: (mode: GameMode) => void
}

const OPTIONS: { mode: GameMode; label: string; hint: string }[] = [
  { mode: 'auction', label: '🔨 מכירה פומבית', hint: 'כישור אחד בכל סבב' },
  { mode: 'allocation', label: '🧩 חלוקת תקציב', hint: 'כל הכישורים פתוחים יחד' },
]

/** Facilitator control for choosing the game mode before the game starts. */
export default function GameModeSwitch({ eventId, mode, locked, onChange }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function select(next: GameMode) {
    if (next === mode || locked || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/set-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, mode: next }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'שגיאה'); return }
      onChange(next)
    } catch { setError('שגיאת רשת') }
    finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">מצב משחק</p>
      <div className="grid grid-cols-2 gap-1.5">
        {OPTIONS.map(o => {
          const active = o.mode === mode
          return (
            <button
              key={o.mode}
              type="button"
              onClick={() => select(o.mode)}
              disabled={locked || saving}
              aria-pressed={active}
              className={`rounded-xl px-2 py-2 text-center transition-all border ${
                active
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                  : 'bg-slate-800/60 border-transparent text-slate-400 hover:border-white/10 disabled:hover:border-transparent'
              } ${locked && !active ? 'opacity-30' : ''}`}
            >
              <span className="block text-xs font-bold">{o.label}</span>
              <span className="block text-[10px] opacity-70 mt-0.5">{o.hint}</span>
            </button>
          )
        })}
      </div>
      {locked && (
        <p className="text-[10px] text-slate-600 text-center">המצב נעול כי המשחק כבר התחיל. איפוס משחק משחרר אותו.</p>
      )}
      {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}
    </div>
  )
}
