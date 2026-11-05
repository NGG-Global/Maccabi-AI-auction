import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import LiveWrapper from '@/components/admin/live/LiveWrapper'
import { getLatestRound, getRoomDetail } from '@/lib/rooms/service'
import { Notice } from '@/components/game/ui'

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
      <main className="bg-dots flex min-h-screen items-center justify-center px-4" dir="rtl">
        <div className="flex w-full max-w-md flex-col gap-4 rounded-[24px] border-[3px] border-ink bg-card p-6 text-center shadow-piece-md">
          <Notice>הסשן בארכיון ואינו ניתן להפעלה.</Notice>
          <Link href="/admin" className="text-[15px] font-semibold text-ink-2 underline decoration-ink/30 underline-offset-4 hover:text-ink">חזרה לרשימת הסשנים</Link>
        </div>
      </main>
    )
  }

  return <LiveWrapper room={detail.room} traits={detail.traits} initialRound={initialRound} />
}
