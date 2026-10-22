import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/staff'
import { ROOM_ERRORS, badRequest, rpcErrorResponse, unauthorized } from '@/lib/api/respond'

/**
 * Status transitions. "active" opens (or extends) a 12-hour live window;
 * "ended" closes it; "archived" makes the room read-only.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireStaff())) return unauthorized()
  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const status = body?.status
  if (status !== 'active' && status !== 'ended' && status !== 'archived') {
    return badRequest('סטטוס לא תקין')
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('set_room_status', { p_room_id: id, p_status: status })
  if (error) return rpcErrorResponse(error, ROOM_ERRORS, 'שגיאה בעדכון הסטטוס', 'set_room_status')

  const row = data?.[0] ?? null
  return Response.json({
    success: true,
    status: row?.status ?? status,
    activatedAt: row?.activated_at ?? null,
    activeUntil: row?.active_until ?? null,
  })
}
