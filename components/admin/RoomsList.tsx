'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { RoomListItem } from '@/lib/types'
import { logoPublicUrl } from '@/lib/storage/logo'
import StatusPill from '@/components/game/StatusPill'
import CoinIcon from '@/components/game/CoinIcon'
import { Button, LinkButton, Notice, Toast } from '@/components/game/ui'
import { UNIT_LABEL, fmt } from '@/components/game/units'

type Filter = 'all' | 'live' | 'draft' | 'ended' | 'archived'

const FILTERS: Array<[Filter, string]> = [
  ['all', 'הכל'],
  ['live', 'חיים עכשיו'],
  ['draft', 'טיוטות'],
  ['ended', 'הסתיימו'],
  ['archived', 'ארכיון'],
]

const MODE_LABEL = { auction: 'מכירה פומבית', allocation: 'חלוקת תקציב' }

function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function ddmm(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
}

function matches(room: RoomListItem, filter: Filter): boolean {
  switch (filter) {
    case 'all': return room.status !== 'archived'
    case 'live': return room.is_live
    case 'draft': return room.status === 'draft'
    case 'ended': return room.status === 'ended' || (room.status === 'active' && !room.is_live)
    case 'archived': return room.status === 'archived'
  }
}

function Status({ room }: { room: RoomListItem }) {
  if (room.is_live && room.active_until) return <StatusPill kind="live">חי · עד {hhmm(room.active_until)}</StatusPill>
  if (room.status === 'ended') return <StatusPill kind="ended">הסתיים · {ddmm(room.updated_at ?? room.created_at)}</StatusPill>
  if (room.status === 'archived') return <StatusPill kind="archived">בארכיון</StatusPill>
  if (room.status === 'active') return <StatusPill kind="expired">חלון ההפעלה הסתיים</StatusPill>
  return <StatusPill kind="draft">טיוטה</StatusPill>
}

export default function RoomsList({ rooms }: { rooms: RoomListItem[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const q = query.trim()
  const visible = rooms.filter(r => matches(r, filter) && (!q || `${r.title} ${r.client_name ?? ''} ${r.slug}`.includes(q)))

  function say(text: string) {
    setToast(text)
    setTimeout(() => setToast(null), 2600)
  }

  async function call(id: string, path: string, init: RequestInit, onOk?: (data: Record<string, unknown>) => void) {
    setBusyId(id)
    setError(null)
    setMenuFor(null)
    try {
      const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'שגיאה'); return }
      onOk?.(data)
      router.refresh()
    } catch { setError('שגיאת רשת') }
    finally { setBusyId(null) }
  }

  const duplicate = (id: string) =>
    call(id, `/api/admin/rooms/${id}/duplicate`, { method: 'POST', body: '{}' }, data => {
      say('נוצר עותק כטיוטה. אפשר לערוך אותו לפני ההפעלה.')
      if (typeof data.roomId === 'string') router.push(`/admin/rooms/${data.roomId}`)
    })
  const activate = (id: string) =>
    call(id, `/api/admin/rooms/${id}/status`, { method: 'POST', body: JSON.stringify({ status: 'active' }) }, () => {
      router.push(`/admin/rooms/${id}/live`)
    })
  const archive = (id: string) =>
    call(id, `/api/admin/rooms/${id}/status`, { method: 'POST', body: JSON.stringify({ status: 'archived' }) }, () => {
      say('הסשן הועבר לארכיון. אפשר למצוא אותו תחת "ארכיון".')
    })

  return (
    <div className="flex flex-col gap-[22px]" onClick={() => { if (menuFor) setMenuFor(null) }}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[46px] font-bold leading-[1.05] text-ink">הסשנים</h1>
          <p className="m-0 mt-2 max-w-[62ch] text-[16px] leading-[1.5] text-ink-2">
            כל צוות NGG רואה את כל הסשנים. כל סשן הוא מכירה נפרדת, עם מסך מוקרן וקישור הצטרפות משלו.
          </p>
        </div>
        <LinkButton href="/admin/rooms/new" variant="primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          סשן חדש
        </LinkButton>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full gap-[3px] overflow-x-auto rounded-[12px] border-[2.5px] border-ink bg-card p-[3px] shadow-piece-sm" role="radiogroup" aria-label="סינון לפי מצב">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={filter === key}
              onClick={() => setFilter(key)}
              className={`h-[38px] whitespace-nowrap rounded-[9px] px-[14px] text-[14px] font-semibold transition-colors ${
                filter === key ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative flex w-[min(320px,100%)] items-center">
          <span className="sr-only">חיפוש סשן</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="pointer-events-none absolute right-[14px] text-ink-3">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" /><path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם או לקוח"
            className="h-11 w-full rounded-[12px] border-[2.5px] border-ink bg-card pl-[14px] pr-[42px] text-[15px] text-ink placeholder:text-ink-3 focus:shadow-[0_0_0_4px_var(--color-sun)] focus:outline-none"
          />
        </label>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {visible.length === 0 ? (
        <p className="m-0 rounded-[16px] border-[2.5px] border-dashed border-muted-outline bg-card p-10 text-center text-[15px] text-ink-3">
          {rooms.filter(r => r.status !== 'archived').length === 0 && filter === 'all'
            ? 'עדיין אין סשנים. צרו סשן חדש כדי להתחיל.'
            : filter === 'archived' && !q
            ? 'אין סשנים בארכיון.'
            : 'אין סשנים שמתאימים לחיפוש. נסו מילה אחרת או בחרו "הכל".'}
        </p>
      ) : (
        <div className="flex flex-col gap-[10px]" role="table" aria-label="רשימת הסשנים">
          <div className="hidden grid-cols-[minmax(0,2.6fr)_120px_150px_70px_90px_170px_250px] items-center gap-4 px-5 text-[13px] font-semibold text-ink-3 min-[1100px]:grid" role="row">
            <span role="columnheader">סשן</span>
            <span role="columnheader">סוג משחק</span>
            <span role="columnheader">תקציב למשתתף</span>
            <span role="columnheader">פריטים</span>
            <span role="columnheader">משתתפים</span>
            <span role="columnheader">מצב</span>
            <span role="columnheader"><span className="sr-only">פעולות</span></span>
          </div>
          {visible.map(room => {
            const busy = busyId === room.id
            const logo = logoPublicUrl(room.logo_path)
            const archived = room.status === 'archived'
            return (
              <div
                key={room.id}
                role="row"
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 rounded-[20px] border-[2.5px] border-ink px-5 py-4 shadow-piece [grid-template-areas:'name_stat'_'meta_meta'_'act_act'] min-[1100px]:grid-cols-[minmax(0,2.6fr)_120px_150px_70px_90px_170px_250px] min-[1100px]:[grid-template-areas:none] ${
                  room.is_live ? 'bg-[#fffaf0]' : 'bg-card'
                }`}
              >
                <div className="flex min-w-0 items-center gap-[14px] [grid-area:name] min-[1100px]:[grid-area:auto]" role="cell">
                  <span aria-hidden="true" className="hidden h-10 w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] border-[1.5px] border-dashed border-muted-outline text-[10px] text-ink-3 min-[1100px]:flex">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt="" className="h-full w-full bg-card object-contain p-0.5" />
                    ) : 'לוגו'}
                  </span>
                  <div className="min-w-0">
                    <Link href={`/admin/rooms/${room.id}`} className="block truncate text-[21px] font-semibold leading-[1.2] text-ink hover:text-tomato-text">{room.title}</Link>
                    <span className="mt-0.5 block truncate text-[14px] text-ink-3">{room.client_name || 'ללא לקוח'}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 [grid-area:meta] min-[1100px]:contents" role="presentation">
                  <span className="text-[15px] text-ink-2" role="cell">{MODE_LABEL[room.game_mode]}</span>
                  <span className="inline-flex items-center gap-1.5 text-[19px] font-bold text-ink" role="cell">
                    <CoinIcon size={20} /><span className="num">{fmt(room.starting_coins)}</span><small className="text-[13px] font-medium text-ink-3">{UNIT_LABEL}</small>
                  </span>
                  <span className="text-[15px] text-ink-2" role="cell"><span className="text-[13px] min-[1100px]:hidden">פריטים </span><span className="num text-[20px] text-ink">{room.trait_count}</span></span>
                  <span className="text-[15px] text-ink-2" role="cell"><span className="text-[13px] min-[1100px]:hidden">משתתפים </span><span className="num text-[20px] text-ink">{room.participant_count}</span></span>
                </div>
                <div className="[grid-area:stat] min-[1100px]:[grid-area:auto]" role="cell"><Status room={room} /></div>
                <div className="relative flex items-center gap-2 [grid-area:act] min-[1100px]:justify-end min-[1100px]:[grid-area:auto]" role="cell" onClick={e => e.stopPropagation()}>
                  {archived ? (
                    <LinkButton size="sm" href={`/admin/rooms/${room.id}`}>צפייה</LinkButton>
                  ) : room.is_live ? (
                    <>
                      <LinkButton size="sm" variant="primary" href={`/admin/rooms/${room.id}/live`}>מסך מוקרן</LinkButton>
                      <LinkButton size="sm" href={`/admin/rooms/${room.id}`}>עריכה</LinkButton>
                    </>
                  ) : room.status === 'ended' ? (
                    <>
                      <LinkButton size="sm" href={`/admin/rooms/${room.id}/live`}>תוצאות</LinkButton>
                      <LinkButton size="sm" href={`/admin/rooms/${room.id}`}>עריכה</LinkButton>
                    </>
                  ) : room.status === 'active' ? (
                    <>
                      <Button size="sm" variant="primary" onClick={() => activate(room.id)} disabled={busy}>הפעלה מחדש</Button>
                      <LinkButton size="sm" href={`/admin/rooms/${room.id}`}>עריכה</LinkButton>
                    </>
                  ) : (
                    <LinkButton size="sm" variant="primary" href={`/admin/rooms/${room.id}`}>השלמה והפעלה</LinkButton>
                  )}
                  {!archived && (
                    <>
                      <button
                        type="button"
                        aria-label="פעולות נוספות"
                        aria-haspopup="menu"
                        aria-expanded={menuFor === room.id}
                        onClick={() => setMenuFor(menuFor === room.id ? null : room.id)}
                        disabled={busy}
                        className={`press-sm flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border-[2.5px] border-ink bg-card text-ink shadow-piece-sm transition-colors ${menuFor === room.id ? 'bg-sun-tint' : 'hover:bg-sun-tint'}`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                      </button>
                      {menuFor === room.id && (
                        <div role="menu" className="gm-rise absolute left-0 top-11 z-10 min-w-[190px] rounded-[12px] border-[2.5px] border-ink bg-card p-1.5 shadow-piece">
                          <button type="button" role="menuitem" onClick={() => duplicate(room.id)} className="block w-full rounded-[8px] px-3 py-2.5 text-start text-[14px] text-ink hover:bg-sun-tint">שכפול לסשן חדש</button>
                          {(room.status === 'draft' || room.status === 'ended') && (
                            <button type="button" role="menuitem" onClick={() => archive(room.id)} className="block w-full rounded-[8px] px-3 py-2.5 text-start text-[14px] text-ink hover:bg-sun-tint">העברה לארכיון</button>
                          )}
                          {room.status === 'active' && (
                            <span className="block px-3 py-2 text-[12px] text-ink-3">סשן פעיל אפשר להעביר לארכיון אחרי סיומו.</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {toast && <Toast>{toast}</Toast>}
    </div>
  )
}
