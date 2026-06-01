import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/auth/admin'

/**
 * Resets the event for rehearsal:
 * - Deletes all participants, bids, transactions for the event.
 * - Marks all traits as unused.
 * - Closes/cancels all rounds.
 * - Clears event current_round_id.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: 'לא מורשה' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.eventId) {
    return Response.json({ error: 'חסר מזהה אירוע' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Verify event exists
  const { data: event } = await supabase.from('events').select('id').eq('id', body.eventId).single()
  if (!event) {
    return Response.json({ error: 'האירוע לא נמצא' }, { status: 404 })
  }

  // Reset in dependency order
  await supabase.from('wallet_transactions').delete().eq('event_id', body.eventId)
  await supabase.from('bids').delete().in(
    'round_id',
    (await supabase.from('auction_rounds').select('id').eq('event_id', body.eventId)).data?.map(r => r.id) ?? []
  )
  await supabase.from('auction_rounds').delete().eq('event_id', body.eventId)
  await supabase.from('participants').delete().eq('event_id', body.eventId)
  await supabase.from('traits').update({ is_used: false }).eq('event_id', body.eventId)
  await supabase.from('events').update({ current_round_id: null, status: 'active' }).eq('id', body.eventId)

  return Response.json({ success: true })
}
