import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { badRequest, rpcErrorResponse } from '@/lib/api/respond'

// Error codes raised by the submit_allocation stored procedure → HTTP response.
const ALLOCATION_ERRORS = {
  invalid_session:      { status: 401, error: 'פגישה לא תקינה. סרקו את קוד ה-QR מחדש.' },
  room_mismatch:        { status: 403, error: 'החלוקה אינה שייכת לחדר זה' },
  room_not_live:        { status: 409, error: 'החדר אינו פעיל כרגע' },
  allocation_not_open:  { status: 409, error: 'החלוקה סגורה' },
  round_not_open:       { status: 400, error: 'אחד ההיגדים אינו פתוח לחלוקה' },
  invalid_amount:       { status: 400, error: 'הסכומים חייבים להיות מספרים שלמים, 0 ומעלה' },
  insufficient_balance: { status: 400, error: 'סך החלוקה גבוה מהיתרה שלך' },
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  const allocations = body?.allocations
  if (!body?.sessionToken || !body?.roomId || !allocations || typeof allocations !== 'object' || Array.isArray(allocations)) {
    return badRequest('חסרים שדות חובה')
  }
  if (Object.keys(allocations).length > 100) return badRequest(ALLOCATION_ERRORS.invalid_amount.error)
  for (const amount of Object.values(allocations)) {
    if (!Number.isInteger(amount) || (amount as number) < 0) return badRequest(ALLOCATION_ERRORS.invalid_amount.error)
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('submit_allocation', {
    p_session_token: String(body.sessionToken),
    p_room_id: body.roomId,
    p_allocations: allocations,
  })
  if (error) return rpcErrorResponse(error, ALLOCATION_ERRORS, 'שגיאה בשמירת החלוקה', 'submit_allocation')

  return Response.json({ success: true, totalAllocated: data?.[0]?.total_allocated ?? 0 })
}
