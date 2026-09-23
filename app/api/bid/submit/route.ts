import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// Error codes raised by the submit_bid stored procedure → HTTP response.
const BID_ERRORS: Record<string, { status: number; error: string }> = {
  invalid_session:      { status: 401, error: 'פגישה לא תקינה' },
  round_not_found:      { status: 404, error: 'הסבב לא נמצא' },
  event_mismatch:       { status: 403, error: 'אירוע לא תואם' },
  round_not_open:       { status: 400, error: 'הסבב אינו פתוח' },
  invalid_amount:       { status: 400, error: 'סכום ההצעה חייב להיות מספר שלם חיובי' },
  insufficient_balance: { status: 400, error: 'אין מספיק מטבעות ביתרה' },
  bid_not_higher:       { status: 400, error: 'הצעה חדשה חייבת להיות גבוהה מהקודמת' },
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  if (!body?.sessionToken || !body?.roundId || body?.amount == null) {
    return Response.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const amount = Number(body.amount)
  if (!Number.isInteger(amount) || amount <= 0) {
    return Response.json({ error: BID_ERRORS.invalid_amount.error }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Single atomic DB call: resolves the session, share-locks the round
  // (serialised against close_auction_round), validates balance and
  // raise, then upserts the bid — all in one transaction.
  const { error } = await supabase.rpc('submit_bid', {
    p_session_token: String(body.sessionToken),
    p_round_id: body.roundId,
    p_amount: amount,
  })

  if (error) {
    const known = Object.keys(BID_ERRORS).find(code => error.message?.includes(code))
    if (known) {
      return Response.json({ error: BID_ERRORS[known].error }, { status: BID_ERRORS[known].status })
    }
    console.error('submit_bid error:', error)
    return Response.json({ error: 'שגיאה בשמירת ההצעה' }, { status: 500 })
  }

  return Response.json({ success: true, amount })
}
