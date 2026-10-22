import type { PostgrestError } from '@supabase/supabase-js'

export interface ErrorMapping {
  status: number
  error: string
}

/**
 * Maps the error codes raised by the auction RPCs (RAISE EXCEPTION 'code')
 * to HTTP responses. Unknown errors are logged and answered generically.
 */
export function rpcErrorResponse(
  error: PostgrestError,
  map: Record<string, ErrorMapping>,
  fallback: string,
  context: string,
): Response {
  const known = Object.keys(map).find(code => error.message?.includes(code))
  if (known) {
    return Response.json({ error: map[known].error, code: known }, { status: map[known].status })
  }
  // Unique-index violation: a second open auction round for the room.
  if (error.code === '23505') {
    return Response.json({ error: 'יש כבר סבב פתוח בחדר זה. סגרו אותו לפני פתיחת סבב חדש.', code: 'conflict' }, { status: 409 })
  }
  console.error(`${context} error:`, error)
  return Response.json({ error: fallback }, { status: 500 })
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 })
}

export function unauthorized(): Response {
  return Response.json({ error: 'נדרשת כניסת צוות' }, { status: 401 })
}

export const ROOM_ERRORS: Record<string, ErrorMapping> = {
  room_not_found:        { status: 404, error: 'החדר לא נמצא' },
  room_not_live:         { status: 409, error: 'החדר אינו פעיל. לחצו "הפעל חדר" במסך הניהול.' },
  room_archived:         { status: 409, error: 'החדר בארכיון ואינו ניתן לעריכה' },
  room_has_history:      { status: 409, error: 'בחדר זה נוהל משחק. אפשר להעביר אותו לארכיון בלבד.' },
  settings_locked:       { status: 409, error: 'הגדרות המשחק נעולות כל עוד יש בחדר משתתפים או סבבים. אפסו את החדר כדי לערוך.' },
  invalid_transition:    { status: 409, error: 'מעבר הסטטוס אינו אפשרי מהמצב הנוכחי' },
  invalid_status:        { status: 400, error: 'סטטוס לא תקין' },
  invalid_slug:          { status: 400, error: 'כתובת ההצטרפות (slug) חייבת להכיל אותיות לטיניות קטנות, ספרות ומקפים, 3 עד 60 תווים' },
  slug_taken:            { status: 409, error: 'כתובת ההצטרפות כבר בשימוש בחדר אחר' },
  invalid_title:         { status: 400, error: 'הכותרת חייבת להכיל 2 עד 120 תווים' },
  invalid_mode:          { status: 400, error: 'סוג משחק לא תקין' },
  invalid_coins:         { status: 400, error: 'מספר המטבעות ההתחלתי חייב להיות בין 1 ל-1,000,000' },
  invalid_round_seconds: { status: 400, error: 'משך הסבב חייב להיות בין 10 ל-3,600 שניות' },
  invalid_traits:        { status: 400, error: 'רשימת ההיגדים אינה תקינה: לכל היגד נדרשים טקסט (2 עד 120 תווים) וקטגוריה' },
}
