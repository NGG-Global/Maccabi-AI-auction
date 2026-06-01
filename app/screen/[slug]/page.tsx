import ScreenWrapper from './ScreenWrapper'
import type { Event } from '@/lib/types'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ScreenPage({ params }: Props) {
  const { slug } = await params

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-white text-2xl">טוען...</p>
      </main>
    )
  }

  const { createServiceRoleClient } = await import('@/lib/supabase/server')
  const supabase = createServiceRoleClient()

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .single<Event>()

  if (!event) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-white text-2xl">האירוע לא נמצא</p>
      </main>
    )
  }

  return <ScreenWrapper event={event} />
}
