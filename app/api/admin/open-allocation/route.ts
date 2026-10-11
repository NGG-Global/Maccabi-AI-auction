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

  // Single atomic DB call: locks the event, opens one allocation round per
  // unused trait and marks those traits used.
  const { data, error } = await supabase.rpc('open_allocation', {
    p_event_id: body.eventId,
  })

  if (error) {
    if (error.message?.includes('wrong_mode')) {
      return Response.json({ error: 'האירוע אינו במצב חלוקת תקציב' }, { status: 409 })
    }
    if (error.message?.includes('allocation_already_open')) {
      return Response.json({ error: 'החלוקה כבר פתוחה' }, { status: 409 })
    }
    if (error.message?.includes('no_traits')) {
      return Response.json({ error: 'כל הכישורים כבר חולקו. אפסו את המשחק כדי להתחיל מחדש.' }, { status: 409 })
    }
    if (error.message?.includes('event_not_found')) {
      return Response.json({ error: 'האירוע לא נמצא' }, { status: 404 })
    }
    console.error('open_allocation error:', error)
    return Response.json({ error: 'שגיאה בפתיחת החלוקה' }, { status: 500 })
  }

  return Response.json({ success: true, roundCount: data?.[0]?.round_count ?? 0 })
}
