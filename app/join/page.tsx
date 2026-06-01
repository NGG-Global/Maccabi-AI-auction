import JoinWrapper from './JoinWrapper'
import type { Event } from '@/lib/types'

interface Props {
  searchParams: Promise<{ event?: string }>
}

export default async function JoinPage({ searchParams }: Props) {
  const { event: slug } = await searchParams

  if (!slug) {
    return <ErrorScreen message="קוד האירוע חסר. סרקו את קוד ה-QR מחדש." />
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <ErrorScreen message="שגיאת הגדרות שרת." />
  }

  const { createServiceRoleClient } = await import('@/lib/supabase/server')
  const supabase = createServiceRoleClient()

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .single<Event>()

  if (!event) {
    return <ErrorScreen message="האירוע לא נמצא. בדקו את קוד ה-QR." />
  }

  if (event.status === 'ended') {
    return <ErrorScreen message="האירוע הסתיים. תודה על ההשתתפות!" />
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-blue-700 px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">מכירה פומבית</h1>
        <h2 className="text-lg text-gray-500 mb-6">תכונות ניהוליות</h2>

        <div className="bg-blue-50 rounded-xl p-4 mb-8 text-right text-sm text-gray-700 leading-7">
          <p className="font-semibold text-blue-800 mb-2">ברוכים הבאים!</p>
          <p>לרשותך <span className="font-bold text-blue-700">1,000 מטבעות</span>.</p>
          <p>בכל סבב תוצג תכונה ניהולית אחת.</p>
          <p>אפשר להציע עליה מטבעות ולהעלות את ההצעה כל עוד הסבב פתוח.</p>
          <p className="mt-3 font-semibold text-red-700">שימו לב: ההצעה הסופית שלך תרד מהיתרה — גם אם לא זכית.</p>
          <p className="mt-2">המטרה: לבחור מה באמת חשוב לך כמנהל/ת.</p>
        </div>

        <JoinWrapper eventId={event.id} eventSlug={event.slug} />
      </div>
    </main>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-blue-900 px-4">
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
        <p className="text-xl font-semibold text-red-600">{message}</p>
      </div>
    </main>
  )
}
