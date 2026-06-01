import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/auth/admin'
import { determineWinner } from '@/lib/game/winner'
import type { Bid } from '@/lib/types'

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: 'לא מורשה' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.roundId) {
    return Response.json({ error: 'חסר מזהה סבב' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // --- Atomic close logic ---
  // 1. Verify round is open (idempotency guard)
  const { data: round } = await supabase
    .from('auction_rounds')
    .select('id, status, event_id, trait_id')
    .eq('id', body.roundId)
    .single()

  if (!round) {
    return Response.json({ error: 'הסבב לא נמצא' }, { status: 404 })
  }
  if (round.status !== 'open') {
    return Response.json({ error: 'הסבב אינו פתוח' }, { status: 409 })
  }

  // 2. Mark as closed atomically — the WHERE status='open' guard ensures only one
  //    concurrent caller can win this update. If 0 rows are returned, another request
  //    already closed this round.
  const { data: locked, error: closeErr } = await supabase
    .from('auction_rounds')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', body.roundId)
    .eq('status', 'open')
    .select('id')

  if (closeErr) {
    console.error('Close round lock error:', closeErr)
    return Response.json({ error: 'שגיאה בסגירת הסבב' }, { status: 500 })
  }
  if (!locked || locked.length === 0) {
    return Response.json({ error: 'הסבב כבר נסגר' }, { status: 409 })
  }

  // 3. Fetch all final bids for this round
  const { data: bids } = await supabase
    .from('bids')
    .select('id, participant_id, amount, created_at, updated_at')
    .eq('round_id', body.roundId)

  const finalBids = (bids ?? []) as Bid[]
  const winner = determineWinner(finalBids)

  // 4. Charge only the winner — losing bidders keep their coins
  const now = new Date().toISOString()
  if (winner) {
    const { data: p } = await supabase
      .from('participants')
      .select('wallet_balance')
      .eq('id', winner.winnerId)
      .single()

    if (p) {
      const newBalance = Math.max(0, p.wallet_balance - winner.winningAmount)

      await supabase
        .from('participants')
        .update({ wallet_balance: newBalance })
        .eq('id', winner.winnerId)

      await supabase.from('wallet_transactions').insert({
        event_id: round.event_id,
        participant_id: winner.winnerId,
        round_id: body.roundId,
        amount_delta: -winner.winningAmount,
        reason: 'round_bid_payment',
        created_at: now,
      })
    }
  }

  // 5. Record winner and mark trait as used
  if (winner) {
    await supabase
      .from('auction_rounds')
      .update({
        winner_participant_id: winner.winnerId,
        winning_bid_amount: winner.winningAmount,
      })
      .eq('id', body.roundId)
  }

  await supabase
    .from('traits')
    .update({ is_used: true })
    .eq('id', round.trait_id)

  return Response.json({
    success: true,
    winnerId: winner?.winnerId ?? null,
    winningAmount: winner?.winningAmount ?? null,
    bidderCount: finalBids.length,
  })
}
