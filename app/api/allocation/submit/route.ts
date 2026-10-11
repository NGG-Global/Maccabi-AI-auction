import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// Error codes raised by the submit_allocation stored procedure → HTTP response.
const ALLOCATION_ERRORS: Record<string, { status: number; error: string }> = {
  invalid_session:      { status: 401, error: 'פגישה לא תקינה' },
  allocation_not_open:  { status: 409, error: 'החלוקה סגורה' },
  round_not_open:       { status: 400, error: 'אחד הכישורים אינו פתוח לחלוקה' },
  invalid_amount:       { status: 400, error: 'הסכומים חייבים להיות מספרים שלמים, 0 ומעלה' },
  insufficient_balance: { status: 400, error: 'סך החלוקה גבוה מהיתרה שלך' },
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  const allocations = body?.allocations
  if (!body?.sessionToken || !allocations || typeof allocations !== 'object' || Array.isArray(allocations)) {
    return Response.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  // One entry per open trait; anything far larger is not a real client.
  if (Object.keys(allocations).length > 100) {
    return Response.json({ error: ALLOCATION_ERRORS.invalid_amount.error }, { status: 400 })
  }
  for (const amount of Object.values(allocations)) {
    if (!Number.isInteger(amount) || (amount as number) < 0) {
      return Response.json({ error: ALLOCATION_ERRORS.invalid_amount.error }, { status: 400 })
    }
  }

  const supabase = createServiceRoleClient()

  // Single atomic DB call: resolves the session, share-locks the open
  // allocation rounds (serialised against close_allocation), checks the
  // total against the wallet and replaces the participant's allocation.
  const { data, error } = await supabase.rpc('submit_allocation', {
    p_session_token: String(body.sessionToken),
    p_allocations: allocations,
  })

  if (error) {
    const known = Object.keys(ALLOCATION_ERRORS).find(code => error.message?.includes(code))
    if (known) {
      return Response.json({ error: ALLOCATION_ERRORS[known].error, code: known }, { status: ALLOCATION_ERRORS[known].status })
    }
    console.error('submit_allocation error:', error)
    return Response.json({ error: 'שגיאה בשמירת החלוקה' }, { status: 500 })
  }

  return Response.json({ success: true, totalAllocated: data?.[0]?.total_allocated ?? 0 })
}
