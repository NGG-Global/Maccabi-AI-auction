import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import RoomForm from '@/components/admin/RoomForm'
import { getRoomDetail } from '@/lib/rooms/service'

interface Props { params: Promise<{ id: string }> }

export default async function EditRoomPage({ params }: Props) {
  await connection()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const detail = await getRoomDetail(id)
  if (!detail) notFound()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white">{detail.room.title}</h1>
          <p className="text-slate-500 text-sm">
            {detail.room.client_name ? `${detail.room.client_name} · ` : ''}
            נוצר {new Date(detail.room.created_at).toLocaleDateString('he-IL')}
            {detail.room.created_by_email ? ` על ידי ${detail.room.created_by_email}` : ''}
          </p>
        </div>
      </div>
      <RoomForm
        key={detail.room.updated_at ?? detail.room.id}
        room={detail.room}
        traits={detail.traits}
        locked={detail.locked}
        isLive={detail.is_live}
        participantCount={detail.participant_count}
        roundCount={detail.round_count}
      />
    </div>
  )
}
