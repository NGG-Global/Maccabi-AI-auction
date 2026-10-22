import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/staff'
import { ROOM_ERRORS, rpcErrorResponse, unauthorized } from '@/lib/api/respond'
import { isValidSlug, randomSlugSuffix, slugify } from '@/lib/rooms/slug'
import { LOGO_BUCKET } from '@/lib/storage/logo'

/** Copies a room's settings, statements and logo into a new draft. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()
  const { id } = await ctx.params

  const supabase = createServiceRoleClient()
  const { data: source } = await supabase.from('rooms').select('slug, title, logo_path').eq('id', id).maybeSingle()
  if (!source) return Response.json({ error: ROOM_ERRORS.room_not_found.error }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const title = typeof body?.title === 'string' && body.title.trim().length >= 2
    ? body.title.trim()
    : `${source.title} (עותק)`
  let slug = typeof body?.slug === 'string' ? slugify(body.slug) : ''
  if (!isValidSlug(slug)) slug = `${slugify(source.slug as string).slice(0, 50)}-${randomSlugSuffix(4)}`

  // The logo object is copied, so each room owns its file.
  let logoPath: string | null = null
  if (source.logo_path) {
    const ext = (source.logo_path as string).split('.').pop() ?? 'png'
    const target = `rooms/pending-${randomSlugSuffix(8)}/logo-${Date.now()}.${ext}`
    const { error: copyErr } = await supabase.storage.from(LOGO_BUCKET).copy(source.logo_path as string, target)
    if (!copyErr) logoPath = target
    else console.error('logo copy failed:', copyErr)
  }

  const { data, error } = await supabase.rpc('duplicate_room', {
    p_source_room_id: id,
    p_slug: slug,
    p_title: title,
    p_created_by_email: staff.email,
    p_logo_path: logoPath,
  })
  if (error) {
    if (logoPath) await supabase.storage.from(LOGO_BUCKET).remove([logoPath]).catch(() => {})
    return rpcErrorResponse(error, ROOM_ERRORS, 'שגיאה בשכפול החדר', 'duplicate_room')
  }

  const newId = data as string
  // Move the copied logo under the new room's folder.
  if (logoPath) {
    const ext = logoPath.split('.').pop() ?? 'png'
    const finalPath = `rooms/${newId}/logo-${Date.now()}.${ext}`
    const { error: moveErr } = await supabase.storage.from(LOGO_BUCKET).move(logoPath, finalPath)
    if (!moveErr) await supabase.from('rooms').update({ logo_path: finalPath }).eq('id', newId)
  }

  return Response.json({ success: true, roomId: newId, slug }, { status: 201 })
}
