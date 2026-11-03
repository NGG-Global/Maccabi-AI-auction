import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import RoomForm from '@/components/admin/RoomForm'
import { getRoomDetail } from '@/lib/rooms/service'
import StatusPill from '@/components/evening/StatusPill'

interface Props { params: Promise<{ id: string }> }

function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default async function EditRoomPage({ params }: Props) {
  await connection()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const detail = await getRoomDetail(id)
  if (!detail) notFound()
  const { room } = detail

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 self-start text-[15px] font-semibold text-ivory-dim hover:text-ivory">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        חזרה לסשנים
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-[14px]">
          <h1 className="m-0 font-display text-[46px] font-black leading-[1.05] tracking-[-.01em] text-ivory">{room.title}</h1>
          {detail.is_live && room.active_until ? (
            <StatusPill kind="live">חי · עד {hhmm(room.active_until)}</StatusPill>
          ) : room.status === 'ended' ? (
            <StatusPill kind="ended">הסתיים · {new Date(room.updated_at ?? room.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}</StatusPill>
          ) : room.status === 'archived' ? (
            <StatusPill kind="archived">בארכיון</StatusPill>
          ) : room.status === 'active' ? (
            <StatusPill kind="expired">חלון ההפעלה הסתיים</StatusPill>
          ) : (
            <StatusPill kind="draft">טיוטה</StatusPill>
          )}
        </div>
        <p className="m-0 text-[14px] text-ivory-mute">
          {room.client_name ? `${room.client_name} · ` : ''}
          נוצר {new Date(room.created_at).toLocaleDateString('he-IL')}
          {room.created_by_email ? ` על ידי ${room.created_by_email}` : ''}
        </p>
      </div>
      <RoomForm
        key={room.updated_at ?? room.id}
        room={room}
        traits={detail.traits}
        locked={detail.locked}
        isLive={detail.is_live}
        participantCount={detail.participant_count}
        roundCount={detail.round_count}
      />
    </div>
  )
}
