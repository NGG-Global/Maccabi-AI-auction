import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { validateBid } from '@/lib/game/validation'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  if (!body?.sessionToken || !body?.roundId || body?.amount == null) {
    return Response.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const amount = Number(body.amount)
  const supabase = createServiceRoleClient()

  // Resolve participant from session token
  const { data: participant } = await supabase
    .from('participants')
    .select('id, event_id, wallet_balance')
    .eq('session_token', body.sessionToken)
    .single()

  if (!participant) {
    return Response.json({ error: 'פגישה לא תקינה' }, { status: 401 })
  }

  // Fetch round and verify it belongs to the same event
  const { data: round } = await supabase
    .from('auction_rounds')
    .select('id, status, event_id')
    .eq('id', body.roundId)
    .single()

  if (!round) {
    return Response.json({ error: 'הסבב לא נמצא' }, { status: 404 })
  }
  if (round.event_id !== participant.event_id) {
    return Response.json({ error: 'אירוע לא תואם' }, { status: 403 })
  }

  // Check for existing bid
  const { data: existingBid } = await supabase
    .from('bids')
    .select('id, amount')
    .eq('round_id', body.roundId)
    .eq('participant_id', participant.id)
    .maybeSingle()

  const validation = validateBid({
    amount,
    walletBalance: participant.wallet_balance,
    existingBidAmount: existingBid?.amount ?? null,
    roundStatus: round.status,
  })

  if (!validation.valid) {
    return Response.json({ error: validation.error }, { status: 400 })
  }

  // Upsert bid
  if (existingBid) {
    const { error } = await supabase
      .from('bids')
      .update({ amount, updated_at: new Date().toISOString() })
      .eq('id', existingBid.id)

    if (error) {
      console.error('Bid update error:', error)
      return Response.json({ error: 'שגיאה בעדכון ההצעה' }, { status: 500 })
    }
  } else {
    const now = new Date().toISOString()
    const { error } = await supabase.from('bids').insert({
      round_id: body.roundId,
      participant_id: participant.id,
      amount,
      created_at: now,
      updated_at: now,
    })

    if (error) {
      console.error('Bid insert error:', error)
      return Response.json({ error: 'שגיאה בשמירת ההצעה' }, { status: 500 })
    }
  }

  return Response.json({ success: true, amount })
}
