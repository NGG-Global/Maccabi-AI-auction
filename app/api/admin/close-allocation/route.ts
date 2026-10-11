import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/auth/admin'

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: 'לא מורשה' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.eventId) {
    return Response.json({ error: 'חסר מזהה אירוע' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Single atomic DB call: closes every open allocation round, picks each
  // trait's winner, charges every allocation and writes the ledger.
  const { data, error } = await supabase.rpc('close_allocation', {
    p_event_id: body.eventId,
  })

  if (error) {
    if (error.message?.includes('allocation_not_open')) {
      return Response.json({ error: 'החלוקה אינה פתוחה' }, { status: 409 })
    }
    if (error.message?.includes('event_not_found')) {
      return Response.json({ error: 'האירוע לא נמצא' }, { status: 404 })
    }
    console.error('close_allocation error:', error)
    return Response.json({ error: 'שגיאה בסגירת החלוקה' }, { status: 500 })
  }

  const result = data?.[0] ?? null
  return Response.json({
    success: true,
    roundsClosed: result?.rounds_closed ?? 0,
    participantsCharged: result?.participants_charged ?? 0,
    totalCharged: result?.total_charged ?? 0,
  })
}
