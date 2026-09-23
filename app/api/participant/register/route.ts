import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  if (!body?.eventId || !body?.displayName) {
    return Response.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const displayName = String(body.displayName).trim()
  if (displayName.length < 2 || displayName.length > 40) {
    return Response.json({ error: 'שם חייב להכיל 2–40 תווים' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Verify event exists and is active
  const { data: event } = await supabase
    .from('events')
    .select('id, status')
    .eq('id', body.eventId)
    .single()

  if (!event) {
    return Response.json({ error: 'האירוע לא נמצא' }, { status: 404 })
  }
  if (event.status === 'ended') {
    return Response.json({ error: 'האירוע הסתיים' }, { status: 403 })
  }

  const sessionToken = randomUUID()

  const { data: participant, error } = await supabase
    .from('participants')
    .insert({
      event_id: body.eventId,
      display_name: displayName,
      wallet_balance: 1000,
    })
    .select('id, wallet_balance')
    .single()

  if (error || !participant) {
    console.error('Register participant error:', error)
    return Response.json({ error: 'שגיאה ביצירת המשתתף' }, { status: 500 })
  }

  // Session tokens live in a table the browser cannot read (see migration 007).
  const { error: sessionError } = await supabase
    .from('participant_sessions')
    .insert({ participant_id: participant.id, session_token: sessionToken })

  if (sessionError) {
    console.error('Register session error:', sessionError)
    await supabase.from('participants').delete().eq('id', participant.id)
    return Response.json({ error: 'שגיאה ביצירת המשתתף' }, { status: 500 })
  }

  // Record initial wallet grant in ledger
  await supabase.from('wallet_transactions').insert({
    event_id: body.eventId,
    participant_id: participant.id,
    amount_delta: 1000,
    reason: 'initial_grant',
  })

  return Response.json({
    participantId: participant.id,
    sessionToken,
    walletBalance: participant.wallet_balance,
  })
}
