'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GameMode, Room, Trait } from '@/lib/types'
import { isValidSlug, slugify, suggestSlug } from '@/lib/rooms/slug'
import TraitsEditor, { newTraitDraft, type TraitDraft } from './TraitsEditor'
import LogoUploader from './LogoUploader'
import CoinIcon from '@/components/evening/CoinIcon'
import WalletBar from '@/components/evening/WalletBar'
import { Button, Card, CardTitle, ErrorText, FIELD, FIELD_BAD, Hint, LinkButton, Notice, Toast } from '@/components/evening/ui'
import { UNIT_LABEL, fmt, lotNo } from '@/components/evening/units'

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

const TIMER_OPTIONS: Array<[number, string]> = [
  [0, 'ללא ספירה לאחור'],
  [30, '30 שניות'],
  [45, '45 שניות'],
  [60, 'דקה'],
  [90, 'דקה וחצי'],
  [120, 'שתי דקות'],
  [180, 'שלוש דקות'],
]

function toDrafts(traits: Trait[]): TraitDraft[] {
  if (traits.length > 0) {
    return traits.map(t => ({ key: t.id, id: t.id, title: t.title, description: t.description ?? '', category: t.category }))
  }
  return DEFAULT_TRAITS.map(t => ({ ...newTraitDraft(), ...t, description: '' }))
}

type FieldKey = 'title' | 'slug' | 'coins' | 'timer' | 'traits'

function Field({ label, htmlFor, hint, error, errorId, children, className = '' }: {
  label: string; htmlFor: string; hint?: string; error?: string; errorId?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-[7px] ${className}`}>
      <label htmlFor={htmlFor} className="text-[14px] font-semibold text-ivory-dim">{label}</label>
      {children}
      {hint && <Hint>{hint}</Hint>}
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  )
}

export default function RoomForm({ room, traits, locked, isLive, participantCount, roundCount }: Props) {
  const router = useRouter()
  const isNew = room === null
  const readOnly = room?.status === 'archived'

  const [title, setTitle] = useState(room?.title ?? '')
  const [clientName, setClientName] = useState(room?.client_name ?? '')
  const [slug, setSlug] = useState(room?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [gameMode, setGameMode] = useState<GameMode>(room?.game_mode ?? 'auction')
  const [startingCoins, setStartingCoins] = useState(fmt(room?.starting_coins ?? 1000))
  const [roundSeconds, setRoundSeconds] = useState(room?.default_round_seconds ? String(room.default_round_seconds) : '')
  const [traitDrafts, setTraitDrafts] = useState<TraitDraft[]>(() => toDrafts(traits))
  const [logoPath, setLogoPath] = useState<string | null>(room?.logo_path ?? null)

  const [saving, setSaving] = useState<'draft' | 'live' | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [badTraitKeys, setBadTraitKeys] = useState<Set<string>>(new Set())
  const [barMessage, setBarMessage] = useState<string | null>(null)
  const [toast, setToast] = useState<{ tone: 'neutral' | 'error'; text: string } | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Suggest a slug from the title until the facilitator edits the slug field.
  function handleTitleChange(next: string) {
    setTitle(next)
    clearError('title')
    if (!slugTouched) setSlug(suggestSlug(next))
  }

  const gameLocked = locked || readOnly
  const coins = Number(startingCoins.replace(/[^\d]/g, '')) || 0
  const filledCount = traitDrafts.filter(t => t.title.trim().length >= 2).length
  const joinUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/join?room=${slug}` : `/join?room=${slug}`),
    [slug],
  )
  const timerValue = roundSeconds.trim() === '' ? 0 : Number(roundSeconds)
  const timerOptions = TIMER_OPTIONS.some(([v]) => v === timerValue) ? TIMER_OPTIONS : [...TIMER_OPTIONS, [timerValue, `${timerValue} שניות`] as [number, string]]

  function clearError(key: FieldKey) {
    setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev))
    setBarMessage(null)
  }

  function say(tone: 'neutral' | 'error', text: string) {
    setToast({ tone, text })
    setTimeout(() => setToast(null), 3200)
  }

  /** Validates on save: marks the fields, counts them, scrolls and focuses the first. */
  function validate(): boolean {
    const next: Partial<Record<FieldKey, string>> = {}
    const order: FieldKey[] = []
    const t = title.trim()
    if (!t) { next.title = 'חסר שם לסשן.'; order.push('title') }
    else if (t.length < 2 || t.length > 120) { next.title = 'השם צריך להכיל 2 עד 120 תווים.'; order.push('title') }
    if (!slug) { next.slug = 'חסרה כתובת לסשן. היא תופיע בקישור ההצטרפות.'; order.push('slug') }
    else if (!isValidSlug(slug)) { next.slug = 'הכתובת צריכה להכיל 3 עד 60 אותיות לטיניות קטנות, ספרות או מקפים.'; order.push('slug') }
    if (!Number.isInteger(coins) || coins < 1 || coins > 1_000_000) { next.coins = 'התקציב צריך להיות מספר שלם בין 1 ל־1,000,000.'; order.push('coins') }
    if (gameMode === 'auction' && timerValue !== 0 && (timerValue < 10 || timerValue > 3600)) { next.timer = 'משך הסבב צריך להיות בין 10 ל־3,600 שניות.'; order.push('timer') }
    const bad = new Set<string>()
    if (!gameLocked) {
      for (const d of traitDrafts) if (d.title.trim().length < 2 || !d.category) bad.add(d.key)
      if (filledCount < 2) { next.traits = 'צריך לפחות שני פריטים עם טקסט.'; order.push('traits') }
      else if (bad.size > 0) { next.traits = 'לכל פריט צריך טקסט (לפחות 2 תווים) וקטגוריה.'; order.push('traits') }
    }
    setErrors(next)
    setBadTraitKeys(bad)
    const count = order.length
    if (count === 0) { setBarMessage(null); return true }
    setBarMessage(count === 1 ? 'יש שדה אחד שצריך לתקן.' : `יש ${count} שדות שצריך לתקן.`)
    const first = formRef.current?.querySelector<HTMLElement>(`[data-field="${order[0]}"]`)
    first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    first?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled])')?.focus({ preventScroll: true })
    return false
  }

  function payload() {
    return {
      title: title.trim(),
      client_name: clientName.trim(),
      slug,
      game_mode: gameMode,
      starting_coins: coins,
      default_round_seconds: gameMode === 'auction' && timerValue > 0 ? timerValue : null,
      // Statements are sent only while they may change; the server refuses them otherwise.
      traits: gameLocked
        ? null
        : traitDrafts
            .filter(t => t.title.trim().length > 0)
            .map((t, i) => ({ id: t.id, title: t.title.trim(), description: t.description.trim(), category: t.category, sort_order: i + 1 })),
    }
  }

  /** Saves the room; with `live` it then opens the 12-hour window and goes to the projected screen. */
  async function save(mode: 'draft' | 'live') {
    if (readOnly || saving) return
    if (!validate()) return
    setSaving(mode)
    try {
      const res = await fetch(isNew ? '/api/admin/rooms' : `/api/admin/rooms/${room!.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { say('error', data.error ?? 'השמירה נכשלה.'); return }
      const id: string = isNew ? data.roomId : room!.id
      if (mode === 'live' && !isLive) {
        const st = await fetch(`/api/admin/rooms/${id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        })
        const sd = await st.json().catch(() => ({}))
        if (!st.ok) { say('error', sd.error ?? 'הסשן נשמר, אבל ההפעלה נכשלה.'); router.refresh(); return }
        router.push(`/admin/rooms/${id}/live`)
        return
      }
      if (isNew) {
        router.push(`/admin/rooms/${id}`)
      } else {
        say('neutral', isLive ? 'השינויים נשמרו.' : 'הטיוטה נשמרה.')
        router.refresh()
      }
    } catch { say('error', 'שגיאת רשת') }
    finally { setSaving(null) }
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
      if (!res.ok) { say('error', data.error ?? 'שגיאה'); return }
      if (status === 'active') router.push(`/admin/rooms/${room.id}/live`)
      else router.refresh()
    } catch { say('error', 'שגיאת רשת') }
    finally { setBusyAction(null) }
  }

  async function duplicate() {
    if (!room) return
    setBusyAction('duplicate')
    try {
      const res = await fetch(`/api/admin/rooms/${room.id}/duplicate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { say('error', data.error ?? 'השכפול נכשל.'); return }
      router.push(`/admin/rooms/${data.roomId}`)
    } catch { say('error', 'שגיאת רשת') }
    finally { setBusyAction(null) }
  }

  const ruleLine = gameMode === 'auction'
    ? `כל משתתף מקבל ${fmt(coins)} ${UNIT_LABEL}. בכל סבב מוצג פריט אחד, ההצעה הגבוהה זוכה, ורק הזוכה משלם.`
    : `כל משתתף מחלק ${fmt(coins)} ${UNIT_LABEL} בין ${filledCount || 'כל'} הפריטים. כל אחד משלם את מה שהקצה.`
  const firstTitle = traitDrafts.find(t => t.title.trim())?.title.trim() ?? ''
  const previewTitle = title.trim() || 'שם הסשן'

  return (
    <form ref={formRef} onSubmit={e => { e.preventDefault(); save(isLive ? 'live' : 'draft') }} noValidate className="grid grid-cols-1 items-start gap-7 min-[1100px]:grid-cols-[minmax(0,1fr)_420px]">
      {/* ── The form ── */}
      <div className="flex min-w-0 flex-col gap-[18px]">
        {readOnly && <Notice>הסשן בארכיון ומוצג לצפייה בלבד. אפשר לשכפל אותו לסשן חדש.</Notice>}

        <Card>
          <CardTitle>פרטי הסשן</CardTitle>
          <div data-field="title">
            <Field label="שם הסשן" htmlFor="f-title" hint="יוצג בראש המסך המוקרן ובטלפונים." error={errors.title} errorId="e-title">
              <input id="f-title" value={title} onChange={e => handleTitleChange(e.target.value)} maxLength={120} disabled={readOnly} autoComplete="off" placeholder="למשל: תכונות של עובד אחזקה מצוין" aria-invalid={!!errors.title || undefined} aria-describedby={errors.title ? 'e-title' : undefined} className={`${FIELD} ${errors.title ? FIELD_BAD : ''}`} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 min-[700px]:grid-cols-2">
            <Field label="לקוח וקבוצה" htmlFor="f-client">
              <input id="f-client" value={clientName} onChange={e => setClientName(e.target.value)} maxLength={120} disabled={readOnly} autoComplete="off" placeholder="למשל: סורוקה · מערך אחזקה והנדסה" className={FIELD} />
            </Field>
            <div data-field="slug">
              <Field label="כתובת הסשן" htmlFor="f-slug" hint={slug ? joinUrl : 'אותיות לטיניות קטנות, ספרות ומקפים, 3 עד 60 תווים.'} error={errors.slug} errorId="e-slug">
                <input
                  id="f-slug"
                  value={slug}
                  onChange={e => { setSlugTouched(true); clearError('slug'); setSlug(slugify(e.target.value.toLowerCase()) || e.target.value.toLowerCase()) }}
                  dir="ltr"
                  disabled={gameLocked}
                  autoComplete="off"
                  placeholder="team-name"
                  aria-invalid={!!errors.slug || undefined}
                  aria-describedby={errors.slug ? 'e-slug' : undefined}
                  className={`${FIELD} text-left ${errors.slug ? FIELD_BAD : ''}`}
                />
              </Field>
            </div>
          </div>
          <LogoUploader roomId={room?.id ?? null} logoPath={logoPath} disabled={readOnly} onChange={setLogoPath} />
        </Card>

        <Card>
          <CardTitle>סוג המשחק</CardTitle>
          <div className="grid grid-cols-1 gap-[14px] min-[700px]:grid-cols-2" role="radiogroup" aria-label="סוג המשחק">
            {([
              ['auction', 'מכירה פומבית', 'פריט אחד בכל סבב. ההצעה הגבוהה זוכה, ורק הזוכה משלם.'],
              ['allocation', 'חלוקת תקציב', 'כל הפריטים פתוחים יחד. כל משתתף מחלק את התקציב שלו, וההקצאה הגבוהה זוכה.'],
            ] as const).map(([mode, label, desc]) => {
              const selected = gameMode === mode
              return (
                <label
                  key={mode}
                  className={`relative flex cursor-pointer flex-col gap-1.5 rounded-[16px] border-[1.5px] px-5 py-[18px] transition-[border-color,background] has-[input:disabled]:cursor-default has-[input:disabled]:opacity-50 has-[input:focus-visible]:outline has-[input:focus-visible]:outline-[3px] has-[input:focus-visible]:outline-offset-[3px] has-[input:focus-visible]:outline-vermilion ${
                    selected ? 'border-vermilion bg-[#26171a] text-ivory-dim' : 'border-velvet-4 bg-velvet-1 text-ivory-mute'
                  }`}
                >
                  <input type="radio" name="game_mode" value={mode} checked={selected} onChange={() => setGameMode(mode)} disabled={gameLocked} className="sr-only" />
                  {mode === 'auction' ? (
                    <svg className="mb-1.5 h-16 w-[120px]" viewBox="0 0 120 64" aria-hidden="true"><rect x="38" y="8" width="44" height="34" rx="6" fill="currentColor" opacity=".9" /><rect x="8" y="14" width="22" height="22" rx="4" fill="currentColor" opacity=".25" /><rect x="90" y="14" width="22" height="22" rx="4" fill="currentColor" opacity=".25" /><rect x="46" y="50" width="28" height="6" rx="3" fill="var(--color-vermilion)" /></svg>
                  ) : (
                    <svg className="mb-1.5 h-16 w-[120px]" viewBox="0 0 120 64" aria-hidden="true"><rect x="8" y="30" width="16" height="26" rx="3" fill="currentColor" opacity=".35" /><rect x="30" y="16" width="16" height="40" rx="3" fill="var(--color-vermilion)" /><rect x="52" y="38" width="16" height="18" rx="3" fill="currentColor" opacity=".35" /><rect x="74" y="24" width="16" height="32" rx="3" fill="currentColor" opacity=".6" /><rect x="96" y="44" width="16" height="12" rx="3" fill="currentColor" opacity=".35" /></svg>
                  )}
                  <span className="font-display text-[24px] font-black text-ivory">{label}</span>
                  <span className="text-[15px] leading-[1.5] text-ivory-dim">{desc}</span>
                </label>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardTitle>תקציב ומטבעות</CardTitle>
          <div className="grid grid-cols-1 gap-4 min-[700px]:grid-cols-2">
            <div data-field="coins">
              <Field label="תקציב לכל משתתף" htmlFor="f-coins" hint={`היחידה היא ${UNIT_LABEL}.`} error={errors.coins} errorId="e-coins">
                <div className="relative">
                  <CoinIcon size={22} className="pointer-events-none absolute left-3 top-1/2 -mt-[11px]" />
                  <input
                    id="f-coins"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={startingCoins}
                    onChange={e => { setStartingCoins(e.target.value.replace(/[^\d,]/g, '')); clearError('coins') }}
                    onBlur={() => setStartingCoins(coins > 0 ? fmt(coins) : '')}
                    disabled={gameLocked}
                    aria-invalid={!!errors.coins || undefined}
                    className={`${FIELD} num pl-11 text-[20px] ${errors.coins ? FIELD_BAD : ''}`}
                  />
                </div>
              </Field>
            </div>
            {gameMode === 'auction' && (
              <div data-field="timer">
                <Field label="זמן לכל סבב" htmlFor="f-timer" hint="הסגירה נשארת תמיד בידי המנחה." error={errors.timer} errorId="e-timer">
                  <select id="f-timer" value={String(timerValue)} onChange={e => { setRoundSeconds(e.target.value === '0' ? '' : e.target.value); clearError('timer') }} disabled={gameLocked} className={FIELD}>
                    {timerOptions.map(([v, label]) => <option key={v} value={String(v)}>{label}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>
          <p className="m-0 rounded-[12px] bg-velvet-1 px-[14px] py-3 text-[15px] leading-[1.5] text-ivory-dim">{ruleLine}</p>
        </Card>

        <Card>
          <div className="flex items-baseline justify-between gap-3">
            <CardTitle>פריטי המכירה</CardTitle>
            <Hint>{filledCount} {filledCount === 1 ? 'פריט' : 'פריטים'}</Hint>
          </div>
          <Hint className="-mt-1">הסדר כאן הוא הסדר במסך ובטלפונים. הקטגוריה קובעת את הפרופיל האישי של המשתתף.</Hint>
          <div data-field="traits" className="flex flex-col gap-3">
            <TraitsEditor traits={traitDrafts} disabled={gameLocked} invalidKeys={badTraitKeys} onChange={next => { setTraitDrafts(next); clearError('traits'); setBadTraitKeys(new Set()) }} />
            {errors.traits && <ErrorText id="e-traits">{errors.traits}</ErrorText>}
          </div>
        </Card>

        {/* ── Sticky action bar ── */}
        {!readOnly && (
          <div className="sticky bottom-3 z-[4] flex flex-wrap items-center justify-end gap-[10px] rounded-[18px] border border-velvet-3 bg-[rgba(22,14,18,.86)] px-4 py-[14px] shadow-[0_18px_40px_rgba(0,0,0,.45)] backdrop-blur-[12px]">
            <span role="status" className={`me-auto text-[14px] font-semibold ${barMessage ? 'text-error' : 'text-ivory-dim'}`}>
              {barMessage ?? (locked
                ? `הסשן ${isLive ? 'חי' : 'הופעל'} ויש בו ${participantCount} משתתפים${roundCount > 0 ? ` ו־${roundCount} סבבים` : ''}, לכן הגדרות המשחק והפריטים נעולים. אפשר לשנות שם, לקוח ולוגו.`
                : '')}
            </span>
            {!isLive && (
              <Button onClick={() => save('draft')} disabled={saving !== null}>
                {saving === 'draft' ? 'שומרים…' : 'שמירה כטיוטה'}
              </Button>
            )}
            <Button variant="primary" onClick={() => save('live')} disabled={saving !== null}>
              {saving === 'live' ? 'שומרים…' : isLive ? 'שמירת השינויים' : 'שמירה והפעלה ל־12 שעות'}
            </Button>
          </div>
        )}
      </div>

      {/* ── Preview + more actions ── */}
      <aside className="flex flex-col gap-[18px] min-[1100px]:sticky min-[1100px]:top-[18px] min-[1100px]:order-none max-[1099px]:order-first" aria-label="תצוגה מקדימה">
        <div>
          <p className="m-0 mb-2 text-[13px] font-semibold text-ivory-mute">כך זה ייראה במסך המוקרן</p>
          <div className="stage-atmos relative flex aspect-video flex-col justify-between overflow-hidden rounded-[14px] px-[6%] py-[5%] shadow-[0_20px_50px_rgba(0,0,0,.5),0_0_0_1px_var(--color-velvet-3)]" aria-hidden="true">
            <div className="flex justify-between gap-3 text-[13px] text-ivory-dim">
              <b className="truncate font-display text-ivory">{previewTitle}</b>
              <span className="shrink-0">{gameMode === 'auction' ? `פריט 01 מתוך ${lotNo(Math.max(filledCount, 1))}` : clientName || ''}</span>
            </div>
            <p className={`m-0 font-display text-[30px] font-black leading-[1.05] [text-wrap:balance] ${gameMode === 'auction' && !firstTitle ? 'font-bold text-ivory-mute' : 'text-ivory'}`}>
              {gameMode === 'auction' ? (firstTitle || 'הפריט הראשון יופיע כאן') : 'המכירה פתוחה'}
            </p>
            <div className="flex items-end justify-between gap-3">
              {gameMode === 'auction' ? (
                <>
                  <span className="num font-display text-[56px] leading-[.85] text-vermilion">0</span>
                  <span className="text-[13px] text-ivory-dim">{UNIT_LABEL} · ההצעה הגבוהה</span>
                </>
              ) : (
                <>
                  <span className="text-[13px] text-ivory-dim"><span className="num">{fmt(coins)}</span> {UNIT_LABEL} לכל אחד, {filledCount} {filledCount === 1 ? 'פריט' : 'פריטים'}</span>
                  <span className="num font-display text-[44px] leading-[.85] text-vermilion">0</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div>
          <p className="m-0 mb-2 text-[13px] font-semibold text-ivory-mute">וכך בטלפון של המשתתף</p>
          <div className="mx-auto max-w-[300px] rounded-[30px] border-[7px] border-[#2a1c22] bg-velvet-1 px-2 pb-[14px] pt-1" aria-hidden="true">
            <WalletBar remaining={coins} total={coins} unitLabel={UNIT_LABEL} label={gameMode === 'auction' ? 'נשארו לך' : 'נשארו לך לחלק'} name="דנה" className="mt-3" />
          </div>
          <Hint className="mt-[14px] block">קישור ההצטרפות וקוד ה־QR נוצרים ברגע שהסשן נשמר.</Hint>
        </div>

        {room && (
          <div className="flex flex-col gap-2 rounded-[16px] border border-velvet-3 bg-velvet-2 p-4">
            <p className="m-0 text-[13px] font-semibold text-ivory-mute">פעולות נוספות</p>
            {isLive && (
              <LinkButton href={`/admin/rooms/${room.id}/live`} size="sm">למסך המוקרן</LinkButton>
            )}
            {!readOnly && !isLive && !isNew && (
              <Button size="sm" onClick={() => setStatus('active')} disabled={busyAction !== null}>הפעלה ל־12 שעות בלי לשמור</Button>
            )}
            <Button size="sm" onClick={duplicate} disabled={busyAction !== null}>שכפול לסשן חדש</Button>
            {isLive && !readOnly && (
              confirmEnd
                ? <Button size="sm" variant="primary" onClick={() => setStatus('ended')} disabled={busyAction !== null}>אישור סיום הסשן</Button>
                : <Button size="sm" variant="danger" onClick={() => setConfirmEnd(true)}>סיום הסשן</Button>
            )}
            {(room.status === 'draft' || room.status === 'ended') && (
              confirmArchive
                ? <Button size="sm" variant="primary" onClick={() => setStatus('archived')} disabled={busyAction !== null}>אישור ההעברה לארכיון</Button>
                : <Button size="sm" onClick={() => setConfirmArchive(true)}>העברה לארכיון</Button>
            )}
          </div>
        )}
      </aside>
      {toast && <Toast tone={toast.tone}>{toast.text}</Toast>}
    </form>
  )
}
