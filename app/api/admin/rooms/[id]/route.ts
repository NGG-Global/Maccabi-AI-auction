import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/staff'
import { getRoomDetail } from '@/lib/rooms/service'
import { parseRoomInput } from '@/lib/rooms/validate'
import { ROOM_ERRORS, badRequest, rpcErrorResponse, unauthorized } from '@/lib/api/respond'
import { LOGO_BUCKET } from '@/lib/storage/logo'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await requireStaff())) return unauthorized()
  const { id } = await ctx.params
  const detail = await getRoomDetail(id)
  if (!detail) return Response.json({ error: ROOM_ERRORS.room_not_found.error }, { status: 404 })
  return Response.json(detail)
}

/** Updates settings and statements. Game-shaping settings are refused while the room holds play data. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireStaff())) return unauthorized()
  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = parseRoomInput(body, { requireTraits: false })
  if (!parsed.ok) return badRequest(parsed.error)
  const input = parsed.value

  const supabase = createServiceRoleClient()
  const { error } = await supabase.rpc('update_room', {
    p_room_id: id,
    p_slug: input.slug,
    p_title: input.title,
    p_client_name: input.client_name,
    p_game_mode: input.game_mode,
    p_starting_coins: input.starting_coins,
    p_default_round_seconds: input.default_round_seconds,
    p_traits: input.traits,
  })
  if (error) return rpcErrorResponse(error, ROOM_ERRORS, 'שגיאה בשמירת החדר', 'update_room')

  return Response.json({ success: true })
}

/** Deletes a draft that never hosted a game (and its logo). Anything else must be archived. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireStaff())) return unauthorized()
  const { id } = await ctx.params

  const supabase = createServiceRoleClient()
  const { data: room } = await supabase.from('rooms').select('logo_path').eq('id', id).maybeSingle()
  if (!room) return Response.json({ error: ROOM_ERRORS.room_not_found.error }, { status: 404 })

  const { error } = await supabase.rpc('delete_room', { p_room_id: id })
  if (error) return rpcErrorResponse(error, ROOM_ERRORS, 'שגיאה במחיקת החדר', 'delete_room')

  if (room.logo_path) {
    await supabase.storage.from(LOGO_BUCKET).remove([room.logo_path as string]).catch(() => {})
  }
  return Response.json({ success: true })
}
