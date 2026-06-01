import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/auth/admin'

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: 'לא מורשה' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.eventId || !body?.traitId) {
    return Response.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Guard: no open round already exists for this event
  const { data: openRound } = await supabase
    .from('auction_rounds')
    .select('id')
    .eq('event_id', body.eventId)
    .eq('status', 'open')
    .maybeSingle()

  if (openRound) {
    return Response.json({ error: 'יש סבב פתוח כבר. סגרו אותו לפני פתיחת סבב חדש.' }, { status: 409 })
  }

  // Verify trait belongs to event and is not yet used
  const { data: trait } = await supabase
    .from('traits')
    .select('id, is_used')
    .eq('id', body.traitId)
    .eq('event_id', body.eventId)
    .single()

  if (!trait) {
    return Response.json({ error: 'התכונה לא נמצאה' }, { status: 404 })
  }
  if (trait.is_used) {
    return Response.json({ error: 'תכונה זו כבר שימשה בסבב קודם' }, { status: 409 })
  }

  const now = new Date().toISOString()

  const { data: round, error } = await supabase
    .from('auction_rounds')
    .insert({
      event_id: body.eventId,
      trait_id: body.traitId,
      status: 'open',
      opened_at: now,
    })
    .select('id')
    .single()

  if (error || !round) {
    console.error('Open round error:', error)
    return Response.json({ error: 'שגיאה בפתיחת הסבב' }, { status: 500 })
  }

  // Update event's current_round_id
  await supabase
    .from('events')
    .update({ current_round_id: round.id })
    .eq('id', body.eventId)

  return Response.json({ success: true, roundId: round.id })
}
