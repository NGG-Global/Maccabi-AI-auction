import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/staff'
import { listRooms } from '@/lib/rooms/service'
import { parseRoomInput } from '@/lib/rooms/validate'
import { ROOM_ERRORS, badRequest, rpcErrorResponse, unauthorized } from '@/lib/api/respond'

export async function GET() {
  if (!(await requireStaff())) return unauthorized()
  try {
    return Response.json({ rooms: await listRooms() })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'שגיאה בטעינת החדרים' }, { status: 500 })
  }
}

/** Creates a draft room with its settings and statements. */
export async function POST(req: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  const body = await req.json().catch(() => null)
  const parsed = parseRoomInput(body, { requireTraits: true })
  if (!parsed.ok) return badRequest(parsed.error)
  const input = parsed.value

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('create_room', {
    p_slug: input.slug,
    p_title: input.title,
    p_client_name: input.client_name,
    p_game_mode: input.game_mode,
    p_starting_coins: input.starting_coins,
    p_default_round_seconds: input.default_round_seconds,
    p_created_by_email: staff.email,
    p_traits: input.traits ?? [],
  })
  if (error) return rpcErrorResponse(error, ROOM_ERRORS, 'שגיאה ביצירת החדר', 'create_room')

  return Response.json({ success: true, roomId: data as string }, { status: 201 })
}
