import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/staff'
import { ROOM_ERRORS, badRequest, rpcErrorResponse, unauthorized } from '@/lib/api/respond'

/**
 * Resets ONE room: its participants, bids, rounds, winners and ledger are
 * deleted in a single transaction and its statements are marked unused.
 * Other rooms are untouched; settings and status of this room are kept.
 */
export async function POST(req: NextRequest) {
  if (!(await requireStaff())) return unauthorized()

  const body = await req.json().catch(() => null)
  if (!body?.roomId) return badRequest('חסר מזהה חדר')

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('reset_room', { p_room_id: body.roomId })
  if (error) return rpcErrorResponse(error, ROOM_ERRORS, 'שגיאה באיפוס החדר', 'reset_room')

  const result = data?.[0] ?? null
  return Response.json({
    success: true,
    participantsRemoved: result?.participants_removed ?? 0,
    roundsRemoved: result?.rounds_removed ?? 0,
  })
}
