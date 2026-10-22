'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { RoomListItem, RoomStatus } from '@/lib/types'

const STATUS_LABEL: Record<RoomStatus, string> = {
  draft: 'טיוטה',
  active: 'פעיל',
  ended: 'הסתיים',
  archived: 'ארכיון',
}

const STATUS_CLASS: Record<RoomStatus, string> = {
  draft: 'bg-slate-700 text-slate-200',
  active: 'bg-green-500/20 text-green-300 border border-green-500/40',
  ended: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  archived: 'bg-slate-800 text-slate-500',
}

const MODE_LABEL = { auction: 'מכירה פומבית', allocation: 'חלוקת תקציב' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function RoomsList({ rooms }: { rooms: RoomListItem[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<'open' | 'archived'>('open')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const visible = rooms.filter(r => (filter === 'archived' ? r.status === 'archived' : r.status !== 'archived'))

  async function call(id: string, path: string, init: RequestInit, onOk?: (data: Record<string, unknown>) => void) {
    setBusyId(id)
    setError(null)
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
      if (typeof data.roomId === 'string') router.push(`/admin/rooms/${data.roomId}`)
    })
  const activate = (id: string) =>
    call(id, `/api/admin/rooms/${id}/status`, { method: 'POST', body: JSON.stringify({ status: 'active' }) }, () => {
      router.push(`/admin/rooms/${id}/live`)
    })
  const archive = (id: string) =>
    call(id, `/api/admin/rooms/${id}/status`, { method: 'POST', body: JSON.stringify({ status: 'archived' }) })
  const remove = (id: string) => {
    setConfirmDelete(null)
    return call(id, `/api/admin/rooms/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-slate-900 rounded-xl p-1">
          {([['open', 'חדרים'], ['archived', 'ארכיון']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                filter === key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Link
          href="/admin/rooms/new"
          className="bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-xl px-5 py-2.5 font-black transition-all active:scale-95"
        >
          + חדר חדש
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/15 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {visible.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <p className="text-5xl mb-4">🏷️</p>
          <p className="text-slate-300 text-lg font-bold mb-1">
            {filter === 'archived' ? 'אין חדרים בארכיון' : 'עדיין אין חדרים'}
          </p>
          {filter === 'open' && <p className="text-slate-500 text-sm">צרו חדר חדש כדי להתחיל.</p>}
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">חדר</th>
                <th className="text-right px-4 py-3 font-semibold">סטטוס</th>
                <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">סוג</th>
                <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">משתתפים</th>
                <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">נוצר</th>
                <th className="text-right px-4 py-3 font-semibold hidden xl:table-cell">יוצר</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map(room => {
                const busy = busyId === room.id
                return (
                  <tr key={room.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/rooms/${room.id}`} className="text-white font-bold hover:text-amber-300">{room.title}</Link>
                      <p className="text-slate-500 text-xs">
                        {room.client_name && <span>{room.client_name} · </span>}
                        <span dir="ltr">/join?room={room.slug}</span>
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_CLASS[room.status]}`}>
                        {room.is_live ? '🟢 חי' : STATUS_LABEL[room.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 hidden md:table-cell">{MODE_LABEL[room.game_mode]}</td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums hidden lg:table-cell">
                      {room.participant_count} · {room.round_count} סבבים
                    </td>
                    <td className="px-4 py-3 text-slate-400 tabular-nums hidden lg:table-cell">{formatDate(room.created_at)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden xl:table-cell" dir="ltr">{room.created_by_email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {room.status !== 'archived' && (
                          room.is_live ? (
                            <Link href={`/admin/rooms/${room.id}/live`} className="bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-1.5 text-xs font-bold">
                              מסך חי
                            </Link>
                          ) : (
                            <button onClick={() => activate(room.id)} disabled={busy} className="bg-green-700/80 hover:bg-green-600 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 text-xs font-bold">
                              הפעל
                            </button>
                          )
                        )}
                        <Link href={`/admin/rooms/${room.id}`} className="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold">
                          {room.status === 'archived' ? 'צפייה' : 'עריכה'}
                        </Link>
                        <button onClick={() => duplicate(room.id)} disabled={busy} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold">
                          שכפול
                        </button>
                        {(room.status === 'draft' || room.status === 'ended') && (
                          <button onClick={() => archive(room.id)} disabled={busy} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-400 rounded-lg px-3 py-1.5 text-xs font-semibold">
                            ארכיון
                          </button>
                        )}
                        {room.status === 'draft' && !room.locked && !room.activated_at && (
                          confirmDelete === room.id ? (
                            <button onClick={() => remove(room.id)} disabled={busy} className="bg-red-700 hover:bg-red-600 text-white rounded-lg px-3 py-1.5 text-xs font-bold">
                              אשר מחיקה
                            </button>
                          ) : (
                            <button onClick={() => setConfirmDelete(room.id)} disabled={busy} className="text-red-400 hover:text-red-300 rounded-lg px-2 py-1.5 text-xs font-semibold">
                              מחיקה
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
