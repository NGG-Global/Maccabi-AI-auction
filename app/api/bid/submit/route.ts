import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { badRequest, rpcErrorResponse } from '@/lib/api/respond'

// Error codes raised by the submit_bid stored procedure → HTTP response.
const BID_ERRORS = {
  invalid_session:      { status: 401, error: 'פגישה לא תקינה. סרקו את קוד ה-QR מחדש.' },
  room_mismatch:        { status: 403, error: 'ההצעה אינה שייכת לחדר זה' },
  room_not_live:        { status: 409, error: 'החדר אינו פעיל כרגע' },
  round_not_found:      { status: 404, error: 'הסבב לא נמצא' },
  wrong_mode:           { status: 400, error: 'המשחק במצב חלוקת תקציב' },
  round_not_open:       { status: 400, error: 'הסבב אינו פתוח' },
  invalid_amount:       { status: 400, error: 'סכום ההצעה חייב להיות מספר שלם חיובי' },
  insufficient_balance: { status: 400, error: 'אין מספיק מטבעות ביתרה' },
  bid_not_higher:       { status: 400, error: 'הצעה חדשה חייבת להיות גבוהה מהקודמת' },
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.sessionToken || !body?.roomId || !body?.roundId || body?.amount == null) {
    return badRequest('חסרים שדות חובה')
  }

  const amount = Number(body.amount)
  if (!Number.isInteger(amount) || amount <= 0) return badRequest(BID_ERRORS.invalid_amount.error)

  const supabase = createServiceRoleClient()
  // One atomic DB call: resolves the session, checks it belongs to the
  // room, share-locks the round (serialised against close_auction_round),
  // validates balance and raise, then upserts the bid.
  const { error } = await supabase.rpc('submit_bid', {
    p_session_token: String(body.sessionToken),
    p_room_id: body.roomId,
    p_round_id: body.roundId,
    p_amount: amount,
  })
  if (error) return rpcErrorResponse(error, BID_ERRORS, 'שגיאה בשמירת ההצעה', 'submit_bid')

  return Response.json({ success: true, amount })
}
