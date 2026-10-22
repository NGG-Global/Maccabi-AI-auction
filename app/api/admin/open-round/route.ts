import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/staff'
import { ROOM_ERRORS, badRequest, rpcErrorResponse, unauthorized } from '@/lib/api/respond'

const ERRORS = {
  ...ROOM_ERRORS,
  wrong_mode:        { status: 409, error: 'החדר במצב חלוקת תקציב' },
  trait_unavailable: { status: 409, error: 'היגד זה כבר שימש בסבב קודם' },
}

export async function POST(req: NextRequest) {
  if (!(await requireStaff())) return unauthorized()

  const body = await req.json().catch(() => null)
  if (!body?.roomId || !body?.traitId) return badRequest('חסרים שדות חובה')

  const supabase = createServiceRoleClient()
  // One atomic DB call: checks the room is live, locks the trait, marks it
  // used, inserts the round and updates current_round_id.
  const { data, error } = await supabase.rpc('open_auction_round', {
    p_room_id: body.roomId,
    p_trait_id: body.traitId,
  })
  if (error) return rpcErrorResponse(error, ERRORS, 'שגיאה בפתיחת הסבב', 'open_auction_round')

  const roundId = data?.[0]?.round_id ?? null
  if (!roundId) return Response.json({ error: 'שגיאה בפתיחת הסבב' }, { status: 500 })
  return Response.json({ success: true, roundId })
}
