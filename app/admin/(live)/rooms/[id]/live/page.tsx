import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import LiveWrapper from '@/components/admin/live/LiveWrapper'
import { getLatestRound, getRoomDetail } from '@/lib/rooms/service'

interface Props { params: Promise<{ id: string }> }

/** The dedicated projected screen of one room. Rendered per request. */
export default async function RoomLivePage({ params }: Props) {
  await connection()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [detail, initialRound] = await Promise.all([getRoomDetail(id), getLatestRound(id)])
  if (!detail) notFound()

  if (detail.room.status === 'archived') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-xl text-slate-300 mb-3">החדר בארכיון ואינו ניתן להפעלה.</p>
          <Link href="/admin" className="text-amber-400 underline text-sm">חזרה לרשימת החדרים</Link>
        </div>
      </main>
    )
  }

  return <LiveWrapper room={detail.room} traits={detail.traits} initialRound={initialRound} />
}
