import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/auth/admin'

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: 'לא מורשה' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.eventId || (body?.mode !== 'auction' && body?.mode !== 'allocation')) {
    return Response.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Locks the event and refuses while any round exists, so the mode can
  // only change before the game starts (or after a reset).
  const { data, error } = await supabase.rpc('set_game_mode', {
    p_event_id: body.eventId,
    p_mode: body.mode,
  })

  if (error) {
    if (error.message?.includes('game_in_progress')) {
      return Response.json({ error: 'אי אפשר להחליף מצב משחק אחרי שהמשחק התחיל. אפסו את המשחק קודם.' }, { status: 409 })
    }
    if (error.message?.includes('event_not_found')) {
      return Response.json({ error: 'האירוע לא נמצא' }, { status: 404 })
    }
    console.error('set_game_mode error:', error)
    return Response.json({ error: 'שגיאה בהחלפת מצב המשחק' }, { status: 500 })
  }

  return Response.json({ success: true, mode: data })
}
