import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/auth/admin'

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: 'לא מורשה' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.eventId || !body?.traitId) {
    return Response.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Single atomic DB call: locks trait, marks it used, inserts round,
  // updates current_round_id — all in one transaction. The partial
  // UNIQUE INDEX uq_one_open_round_per_event enforces the one-open-round
  // invariant at DB level, preventing race conditions.
  const { data, error } = await supabase.rpc('open_auction_round', {
    p_event_id: body.eventId,
    p_trait_id: body.traitId,
  })

  if (error) {
    if (error.message?.includes('trait_unavailable')) {
      return Response.json({ error: 'תכונה זו כבר שימשה בסבב קודם' }, { status: 409 })
    }
    // Unique-index violation = concurrent open round already exists
    if (error.code === '23505') {
      return Response.json({ error: 'יש סבב פתוח כבר. סגרו אותו לפני פתיחת סבב חדש.' }, { status: 409 })
    }
    console.error('open_auction_round error:', error)
    return Response.json({ error: 'שגיאה בפתיחת הסבב' }, { status: 500 })
  }

  const roundId = data?.[0]?.round_id ?? null
  if (!roundId) {
    return Response.json({ error: 'שגיאה בפתיחת הסבב' }, { status: 500 })
  }

  return Response.json({ success: true, roundId })
}
