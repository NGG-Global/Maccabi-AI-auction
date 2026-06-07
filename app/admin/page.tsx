import AdminWrapper from './AdminWrapper'
import type { Event, AuctionRound, Trait } from '@/lib/types'

export default async function AdminPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">הגדירו את משתני הסביבה של Supabase.</p>
      </main>
    )
  }

  const { createServiceRoleClient } = await import('@/lib/supabase/server')
  const supabase = createServiceRoleClient()

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single<Event>()

  if (!event) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-2xl p-8 text-center">
          <p className="text-xl text-gray-600">לא נמצא אירוע פעיל.</p>
        </div>
      </main>
    )
  }

  const { data: traits } = await supabase
    .from('traits')
    .select('*')
    .eq('event_id', event.id)
    .order('sort_order', { ascending: true })

  const { data: rounds } = await supabase
    .from('auction_rounds')
    .select('*, trait:traits(*), winner:participants!auction_rounds_winner_participant_id_fkey(*)')
    .eq('event_id', event.id)
    .in('status', ['open', 'closed'])
    .order('created_at', { ascending: false })
    .limit(1)

  const currentRound = (rounds?.[0] ?? null) as AuctionRound | null

  return (
    <AdminWrapper
      event={event}
      traits={(traits ?? []) as Trait[]}
      initialRound={currentRound}
    />
  )
}
