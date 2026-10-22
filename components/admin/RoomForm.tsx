'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { GameMode, Room, Trait } from '@/lib/types'
import { isValidSlug, slugify, suggestSlug } from '@/lib/rooms/slug'
import TraitsEditor, { newTraitDraft, type TraitDraft } from './TraitsEditor'
import LogoUploader from './LogoUploader'

interface Props {
  /** null when creating a new room */
  room: Room | null
  traits: Trait[]
  /** true while the room holds play data: game-shaping settings cannot change */
  locked: boolean
  isLive: boolean
  participantCount: number
  roundCount: number
}

const DEFAULT_TRAITS: Array<Pick<TraitDraft, 'title' | 'category'>> = [
  { title: 'להניע אנשים וצוותים', category: 'מנהיגות' },
  { title: 'לפתח אנשים', category: 'יחסים' },
  { title: 'ליצור מרחב בטוח לחשיבה משותפת', category: 'יחסים' },
  { title: 'להניע ללא סמכות פורמלית', category: 'מנהיגות' },
  { title: 'למפות', category: 'שיפוט' },
  { title: 'לתעדף', category: 'שיפוט' },
  { title: 'לייצר בסיס להחלטה', category: 'שיפוט' },
]

function toDrafts(traits: Trait[]): TraitDraft[] {
  if (traits.length > 0) {
    return traits.map(t => ({ key: t.id, id: t.id, title: t.title, description: t.description ?? '', category: t.category }))
  }
  return DEFAULT_TRAITS.map(t => ({ ...newTraitDraft(), ...t, description: '' }))
}

const inputClass =
  'w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-white focus:outline-none transition-colors disabled:opacity-60'

export default function RoomForm({ room, traits, locked, isLive, participantCount, roundCount }: Props) {
  const router = useRouter()
  const isNew = room === null
  const readOnly = room?.status === 'archived'

  const [title, setTitle] = useState(room?.title ?? '')
  const [clientName, setClientName] = useState(room?.client_name ?? '')
  const [slug, setSlug] = useState(room?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [gameMode, setGameMode] = useState<GameMode>(room?.game_mode ?? 'auction')
  const [startingCoins, setStartingCoins] = useState(String(room?.starting_coins ?? 1000))
  const [roundSeconds, setRoundSeconds] = useState(room?.default_round_seconds ? String(room.default_round_seconds) : '')
  const [traitDrafts, setTraitDrafts] = useState<TraitDraft[]>(() => toDrafts(traits))
  const [logoPath, setLogoPath] = useState<string | null>(room?.logo_path ?? null)

  const [saving, setSaving] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Suggest a slug from the title until the facilitator edits the slug field.
  function handleTitleChange(next: string) {
    setTitle(next)
    if (!slugTouched) setSlug(suggestSlug(next))
  }

  const gameLocked = locked || readOnly
  const slugOk = isValidSlug(slug)
  const joinUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/join?room=${slug}` : `/join?room=${slug}`),
    [slug],
  )

  function showMsg(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  function payload() {
    return {
      title: title.trim(),
      client_name: clientName.trim(),
      slug,
      game_mode: gameMode,
      starting_coins: Number(startingCoins),
      default_round_seconds: gameMode === 'auction' && roundSeconds.trim() !== '' ? Number(roundSeconds) : null,
      // Statements are sent only while they may change; the server refuses them otherwise.
      traits: gameLocked
        ? null
        : traitDrafts.map((t, i) => ({ id: t.id, title: t.title.trim(), description: t.description.trim(), category: t.category, sort_order: i + 1 })),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (readOnly) return
    if (!gameLocked && traitDrafts.some(t => !t.category || t.title.trim().length < 2)) {
      showMsg('error', 'לכל היגד נדרשים טקסט (לפחות 2 תווים) וקטגוריה')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(isNew ? '/api/admin/rooms' : `/api/admin/rooms/${room!.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showMsg('error', data.error ?? 'שגיאה בשמירה'); return }
      if (isNew) {
        router.push(`/admin/rooms/${data.roomId}`)
      } else {
        showMsg('success', 'החדר נשמר')
        router.refresh()
      }
    } catch { showMsg('error', 'שגיאת רשת') }
    finally { setSaving(false) }
  }

  async function setStatus(status: 'active' | 'ended' | 'archived') {
    if (!room) return
    setBusyAction(status)
    try {
      const res = await fetch(`/api/admin/rooms/${room.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showMsg('error', data.error ?? 'שגיאה'); return }
      if (status === 'active') router.push(`/admin/rooms/${room.id}/live`)
      else router.refresh()
    } catch { showMsg('error', 'שגיאת רשת') }
    finally { setBusyAction(null) }
  }

  async function duplicate() {
    if (!room) return
    setBusyAction('duplicate')
    try {
      const res = await fetch(`/api/admin/rooms/${room.id}/duplicate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showMsg('error', data.error ?? 'שגיאה בשכפול'); return }
      router.push(`/admin/rooms/${data.roomId}`)
    } catch { showMsg('error', 'שגיאת רשת') }
    finally { setBusyAction(null) }
  }

  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
      {/* ── Settings ── */}
      <div className="flex flex-col gap-6">
        {message && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
            message.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {gameLocked && !readOnly && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-200">
            🔒 בחדר יש {participantCount} משתתפים ו-{roundCount} סבבים, ולכן סוג המשחק, המטבעות, משך הסבב, הכתובת וההיגדים נעולים.
            כותרת, שם לקוח ולוגו ניתנים לעריכה. איפוס החדר במסך החי משחרר את הנעילה.
          </div>
        )}
        {readOnly && (
          <div className="bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300">
            📦 החדר בארכיון ומוצג לצפייה בלבד. אפשר לשכפל אותו לחדר חדש.
          </div>
        )}

        <section className="glass rounded-2xl p-6 flex flex-col gap-4">
          <h2 className="text-white font-black text-lg">פרטי החדר</h2>
          <label className="flex flex-col gap-1.5 text-sm text-slate-300">
            כותרת החדר *
            <input value={title} onChange={e => handleTitleChange(e.target.value)} required minLength={2} maxLength={120} disabled={readOnly} className={inputClass} placeholder="למשל: סדנת מנהיגות, קבוצה 3" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-slate-300">
            שם הלקוח
            <input value={clientName} onChange={e => setClientName(e.target.value)} maxLength={120} disabled={readOnly} className={inputClass} placeholder="יוצג על המסך המוקרן ובטלפונים" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-slate-300">
            כתובת הצטרפות (slug) *
            <input
              value={slug}
              onChange={e => { setSlugTouched(true); setSlug(slugify(e.target.value.toLowerCase()) || e.target.value.toLowerCase()) }}
              dir="ltr"
              required
              disabled={gameLocked}
              className={`${inputClass} font-mono text-left ${slug && !slugOk ? 'border-red-500' : ''}`}
              placeholder="leadership-group-3"
            />
            <span className="text-xs text-slate-500" dir="ltr">{joinUrl}</span>
            {slug && !slugOk && <span className="text-xs text-red-400">אותיות לטיניות קטנות, ספרות ומקפים בלבד, 3 עד 60 תווים</span>}
          </label>
          <div className="flex flex-col gap-1.5 text-sm text-slate-300">
            לוגו הלקוח
            <LogoUploader roomId={room?.id ?? null} logoPath={logoPath} disabled={readOnly} onChange={setLogoPath} />
          </div>
        </section>

        <section className="glass rounded-2xl p-6 flex flex-col gap-4">
          <h2 className="text-white font-black text-lg">הגדרות המשחק</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['auction', 'מכירה פומבית', 'היגד אחד בכל סבב. רק הזוכה משלם.'],
              ['allocation', 'חלוקת תקציב', 'כל ההיגדים פתוחים יחד. כולם משלמים את מה שהקצו.'],
            ] as const).map(([mode, label, desc]) => (
              <button
                type="button"
                key={mode}
                onClick={() => setGameMode(mode)}
                disabled={gameLocked}
                className={`text-right rounded-xl border p-4 transition-all disabled:opacity-60 ${
                  gameMode === mode ? 'border-amber-500 bg-amber-500/10' : 'border-white/10 bg-slate-900 hover:border-white/20'
                }`}
              >
                <p className="text-white font-bold">{mode === 'auction' ? '🎯' : '🧩'} {label}</p>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">{desc}</p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-sm text-slate-300">
              מטבעות לכל משתתף *
              <input type="number" min={1} max={1000000} step={1} value={startingCoins} onChange={e => setStartingCoins(e.target.value)} required disabled={gameLocked} className={inputClass} />
            </label>
            {gameMode === 'auction' && (
              <label className="flex flex-col gap-1.5 text-sm text-slate-300">
                משך סבב ברירת מחדל (שניות)
                <input type="number" min={10} max={3600} step={1} value={roundSeconds} onChange={e => setRoundSeconds(e.target.value)} disabled={gameLocked} className={inputClass} placeholder="ללא ספירה לאחור" />
                <span className="text-xs text-slate-500">ספירה לאחור על המסך ובטלפונים. הסגירה נשארת בידי המנחה.</span>
              </label>
            )}
          </div>
        </section>

        <section className="glass rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-black text-lg">היגדים</h2>
            <span className="text-slate-500 text-xs">{traitDrafts.length} היגדים · לכל היגד חובה קטגוריה</span>
          </div>
          <TraitsEditor traits={traitDrafts} disabled={gameLocked} onChange={setTraitDrafts} />
        </section>
      </div>

      {/* ── Actions ── */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-4">
        {!readOnly && (
          <button
            type="submit"
            disabled={saving || !slugOk || title.trim().length < 2}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-slate-900 rounded-xl py-3 font-black transition-all active:scale-95"
          >
            {saving ? 'שומר...' : isNew ? 'יצירת החדר' : 'שמירת שינויים'}
          </button>
        )}

        {room && !readOnly && (
          <div className="glass rounded-2xl p-4 flex flex-col gap-2">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">הפעלה</p>
            {isLive ? (
              <>
                <Link href={`/admin/rooms/${room.id}/live`} className="bg-green-600 hover:bg-green-500 text-white rounded-xl py-2.5 text-center font-bold transition-all">
                  🖥 למסך החי
                </Link>
                {!confirmEnd ? (
                  <button type="button" onClick={() => setConfirmEnd(true)} className="text-slate-400 hover:text-white text-sm py-1">סיום החדר</button>
                ) : (
                  <button type="button" onClick={() => setStatus('ended')} disabled={busyAction !== null} className="bg-red-700 hover:bg-red-600 text-white rounded-xl py-2 text-sm font-bold">אשר סיום</button>
                )}
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStatus('active')} disabled={busyAction !== null || isNew} className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white rounded-xl py-2.5 font-bold transition-all">
                  ▶ הפעל חדר ופתח מסך חי
                </button>
                <p className="text-slate-500 text-[11px] leading-relaxed">ההפעלה פותחת חלון של 12 שעות שבו משתתפים יכולים להצטרף ולהציע. בסיומו יש להפעיל שוב.</p>
              </>
            )}
          </div>
        )}

        {room && (
          <div className="glass rounded-2xl p-4 flex flex-col gap-2">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">עוד</p>
            <button type="button" onClick={duplicate} disabled={busyAction !== null} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl py-2 text-sm font-semibold">
              שכפול לחדר חדש
            </button>
            {(room.status === 'draft' || room.status === 'ended') && (
              !confirmArchive ? (
                <button type="button" onClick={() => setConfirmArchive(true)} className="text-slate-400 hover:text-white text-sm py-1">העברה לארכיון</button>
              ) : (
                <button type="button" onClick={() => setStatus('archived')} disabled={busyAction !== null} className="bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-2 text-sm font-bold">אשר ארכיון</button>
              )
            )}
            <Link href="/admin" className="text-slate-500 hover:text-slate-300 text-sm py-1 text-center">חזרה לרשימה</Link>
          </div>
        )}
        {isNew && <Link href="/admin" className="text-slate-500 hover:text-slate-300 text-sm py-1 text-center">ביטול</Link>}
      </aside>
    </form>
  )
}
