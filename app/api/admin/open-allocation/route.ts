import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/staff'
import { ROOM_ERRORS, badRequest, rpcErrorResponse, unauthorized } from '@/lib/api/respond'

const ERRORS = {
  ...ROOM_ERRORS,
  wrong_mode:              { status: 409, error: 'החדר אינו במצב חלוקת תקציב' },
  allocation_already_open: { status: 409, error: 'החלוקה כבר פתוחה' },
  no_traits:               { status: 409, error: 'כל ההיגדים כבר חולקו. אפסו את החדר כדי להתחיל מחדש.' },
}

export async function POST(req: NextRequest) {
  if (!(await requireStaff())) return unauthorized()

  const body = await req.json().catch(() => null)
  if (!body?.roomId) return badRequest('חסר מזהה חדר')

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('open_allocation', { p_room_id: body.roomId })
  if (error) return rpcErrorResponse(error, ERRORS, 'שגיאה בפתיחת החלוקה', 'open_allocation')

  return Response.json({ success: true, roundCount: data?.[0]?.round_count ?? 0 })
}
