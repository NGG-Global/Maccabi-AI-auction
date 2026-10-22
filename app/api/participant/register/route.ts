import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { badRequest, rpcErrorResponse } from '@/lib/api/respond'

const ERRORS = {
  room_not_found:  { status: 404, error: 'החדר לא נמצא. בדקו את קוד ה-QR.' },
  room_not_live:   { status: 409, error: 'החדר אינו פעיל כרגע. המתינו שהמנחה יפעיל אותו.' },
  invalid_name:    { status: 400, error: 'שם חייב להכיל 2–40 תווים' },
  invalid_session: { status: 500, error: 'שגיאה ביצירת המשתתף' },
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.roomId || !body?.displayName) return badRequest('חסרים שדות חובה')

  const displayName = String(body.displayName).trim()
  if (displayName.length < 2 || displayName.length > 40) return badRequest(ERRORS.invalid_name.error)

  const sessionToken = randomUUID()
  const supabase = createServiceRoleClient()

  // One atomic DB call: verifies the room is live, creates the participant
  // with the room's starting coins, the private session row and the
  // opening ledger entry.
  const { data, error } = await supabase.rpc('register_participant', {
    p_room_id: body.roomId,
    p_display_name: displayName,
    p_session_token: sessionToken,
  })
  if (error) return rpcErrorResponse(error, ERRORS, 'שגיאה ביצירת המשתתף', 'register_participant')

  const row = data?.[0]
  if (!row?.participant_id) return Response.json({ error: 'שגיאה ביצירת המשתתף' }, { status: 500 })

  return Response.json({
    participantId: row.participant_id,
    sessionToken,
    walletBalance: row.wallet_balance,
  })
}
