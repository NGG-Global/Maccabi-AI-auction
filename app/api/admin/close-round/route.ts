import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/staff'
import { badRequest, rpcErrorResponse, unauthorized } from '@/lib/api/respond'

const ERRORS = {
  round_not_open: { status: 409, error: 'הסבב אינו פתוח' },
}

export async function POST(req: NextRequest) {
  if (!(await requireStaff())) return unauthorized()

  const body = await req.json().catch(() => null)
  if (!body?.roomId || !body?.roundId) return badRequest('חסר מזהה חדר או סבב')

  const supabase = createServiceRoleClient()
  // One atomic DB call: locks the round (must belong to the room), closes
  // it, charges the winner, writes the ledger and marks the trait used.
  const { data, error } = await supabase.rpc('close_auction_round', {
    p_room_id: body.roomId,
    p_round_id: body.roundId,
  })
  if (error) return rpcErrorResponse(error, ERRORS, 'שגיאה בסגירת הסבב', 'close_auction_round')

  const result = data?.[0] ?? null
  return Response.json({
    success: true,
    winnerId: result?.winner_id ?? null,
    winningAmount: result?.winning_amount ?? null,
    bidderCount: result?.bidder_count ?? 0,
  })
}
