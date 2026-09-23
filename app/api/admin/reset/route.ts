import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/auth/admin'

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: 'לא מורשה' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.eventId) {
    return Response.json({ error: 'חסר מזהה אירוע' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', body.eventId)
    .single()

  if (!event) {
    return Response.json({ error: 'האירוע לא נמצא' }, { status: 404 })
  }

  // Clear current_round_id FIRST — the FK from events → auction_rounds
  // blocks deletion of rounds while this pointer is still set.
  const { error: e0 } = await supabase
    .from('events')
    .update({ current_round_id: null, status: 'active' })
    .eq('id', body.eventId)
  if (e0) {
    console.error('reset: clear current_round_id failed', e0)
    return Response.json({ error: 'שגיאה באיפוס (events)' }, { status: 500 })
  }

  // Wallet transactions reference participants, so delete before participants.
  const { error: e1 } = await supabase
    .from('wallet_transactions')
    .delete()
    .eq('event_id', body.eventId)
  if (e1) console.error('reset: wallet_transactions', e1)

  // Bids cascade-delete when rounds are deleted, but delete explicitly first
  // in case the cascade isn't applied on the Supabase project yet.
  const { data: roundRows } = await supabase
    .from('auction_rounds')
    .select('id')
    .eq('event_id', body.eventId)

  const roundIds = (roundRows ?? []).map(r => r.id)
  if (roundIds.length > 0) {
    const { error: e2 } = await supabase
      .from('bids')
      .delete()
      .in('round_id', roundIds)
    if (e2) console.error('reset: bids', e2)
  }

  // Now safe to delete rounds (current_round_id already cleared above).
  const { error: e3 } = await supabase
    .from('auction_rounds')
    .delete()
    .eq('event_id', body.eventId)
  if (e3) {
    console.error('reset: auction_rounds', e3)
    return Response.json({ error: 'שגיאה באיפוס (rounds)' }, { status: 500 })
  }

  // Delete participants (cascade removes their bids/transactions if any remain).
  const { error: e4 } = await supabase
    .from('participants')
    .delete()
    .eq('event_id', body.eventId)
  if (e4) {
    console.error('reset: participants', e4)
    return Response.json({ error: 'שגיאה באיפוס (participants)' }, { status: 500 })
  }

  // Restore all traits to unused.
  const { error: e5 } = await supabase
    .from('traits')
    .update({ is_used: false })
    .eq('event_id', body.eventId)
  if (e5) {
    console.error('reset: traits', e5)
    return Response.json({ error: 'שגיאה באיפוס (traits)' }, { status: 500 })
  }

  return Response.json({ success: true })
}
