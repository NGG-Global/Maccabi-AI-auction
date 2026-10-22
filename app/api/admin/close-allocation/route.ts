import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/staff'
import { ROOM_ERRORS, badRequest, rpcErrorResponse, unauthorized } from '@/lib/api/respond'

const ERRORS = {
  ...ROOM_ERRORS,
  allocation_not_open: { status: 409, error: 'החלוקה אינה פתוחה' },
}

export async function POST(req: NextRequest) {
  if (!(await requireStaff())) return unauthorized()

  const body = await req.json().catch(() => null)
  if (!body?.roomId) return badRequest('חסר מזהה חדר')

  const supabase = createServiceRoleClient()
  // One atomic DB call: closes every open allocation round of the room,
  // records each trait's winners, charges every allocation, writes the ledger.
  const { data, error } = await supabase.rpc('close_allocation', { p_room_id: body.roomId })
  if (error) return rpcErrorResponse(error, ERRORS, 'שגיאה בסגירת החלוקה', 'close_allocation')

  const result = data?.[0] ?? null
  return Response.json({
    success: true,
    roundsClosed: result?.rounds_closed ?? 0,
    participantsCharged: result?.participants_charged ?? 0,
    totalCharged: result?.total_charged ?? 0,
    tiedTraits: result?.tied_traits ?? 0,
  })
}
