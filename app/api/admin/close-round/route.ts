import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/auth/admin'

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: 'לא מורשה' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.roundId) {
    return Response.json({ error: 'חסר מזהה סבב' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Single atomic DB call: locks round, closes it, charges winner,
  // writes ledger entry and marks trait used — all in one transaction.
  const { data, error } = await supabase.rpc('close_auction_round', {
    p_round_id: body.roundId,
  })

  if (error) {
    if (error.message?.includes('round_not_open')) {
      return Response.json({ error: 'הסבב אינו פתוח' }, { status: 409 })
    }
    console.error('close_auction_round error:', error)
    return Response.json({ error: 'שגיאה בסגירת הסבב' }, { status: 500 })
  }

  const result = data?.[0] ?? null
  return Response.json({
    success: true,
    winnerId: result?.winner_id ?? null,
    winningAmount: result?.winning_amount ?? null,
    bidderCount: result?.bidder_count ?? 0,
  })
}
