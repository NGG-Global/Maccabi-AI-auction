import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import LiveWrapper from '@/components/admin/live/LiveWrapper'
import { getLatestRound, getRoomDetail } from '@/lib/rooms/service'
import { Notice } from '@/components/evening/ui'

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
      <main className="flex min-h-screen items-center justify-center bg-velvet-1 px-4" dir="rtl">
        <div className="flex w-full max-w-md flex-col gap-4 rounded-[20px] border border-velvet-3 bg-velvet-2 p-6 text-center">
          <Notice>הסשן בארכיון ואינו ניתן להפעלה.</Notice>
          <Link href="/admin" className="text-[15px] font-semibold text-ivory-dim underline decoration-velvet-4 underline-offset-4 hover:text-ivory">חזרה לרשימת הסשנים</Link>
        </div>
      </main>
    )
  }

  return <LiveWrapper room={detail.room} traits={detail.traits} initialRound={initialRound} />
}
