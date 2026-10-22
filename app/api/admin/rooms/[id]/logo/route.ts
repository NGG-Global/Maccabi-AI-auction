import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/staff'
import { ROOM_ERRORS, unauthorized } from '@/lib/api/respond'
import { LOGO_BUCKET, MAX_LOGO_BYTES, checkLogoFile, logoMimeType, logoObjectPath, logoPublicUrl } from '@/lib/storage/logo'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Uploads a client logo (multipart field "file"). The file type is read
 * from its bytes, never from the declared type: PNG, JPG or WEBP, up to 2MB.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  if (!(await requireStaff())) return unauthorized()
  const { id } = await ctx.params

  const supabase = createServiceRoleClient()
  const { data: room } = await supabase.from('rooms').select('id, status, logo_path').eq('id', id).maybeSingle()
  if (!room) return Response.json({ error: ROOM_ERRORS.room_not_found.error }, { status: 404 })
  if (room.status === 'archived') return Response.json({ error: ROOM_ERRORS.room_archived.error }, { status: 409 })

  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_LOGO_BYTES + 64 * 1024) {
    return Response.json({ error: 'הלוגו גדול מ-2MB' }, { status: 413 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return Response.json({ error: 'לא נבחר קובץ' }, { status: 400 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const check = checkLogoFile(bytes)
  if (!check.ok || !check.type) return Response.json({ error: check.error }, { status: 400 })

  const path = logoObjectPath(id, check.type)
  const { error: upErr } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, bytes, { contentType: logoMimeType(check.type), upsert: false, cacheControl: '31536000' })
  if (upErr) {
    console.error('logo upload failed:', upErr)
    return Response.json({ error: 'העלאת הלוגו נכשלה. ודאו שה-bucket auction-logos קיים.' }, { status: 500 })
  }

  const { error: dbErr } = await supabase.from('rooms').update({ logo_path: path }).eq('id', id)
  if (dbErr) {
    await supabase.storage.from(LOGO_BUCKET).remove([path]).catch(() => {})
    return Response.json({ error: 'שמירת הלוגו נכשלה' }, { status: 500 })
  }

  if (room.logo_path && room.logo_path !== path) {
    await supabase.storage.from(LOGO_BUCKET).remove([room.logo_path as string]).catch(() => {})
  }

  return Response.json({ success: true, logoPath: path, logoUrl: logoPublicUrl(path) })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireStaff())) return unauthorized()
  const { id } = await ctx.params

  const supabase = createServiceRoleClient()
  const { data: room } = await supabase.from('rooms').select('id, logo_path').eq('id', id).maybeSingle()
  if (!room) return Response.json({ error: ROOM_ERRORS.room_not_found.error }, { status: 404 })

  const { error } = await supabase.from('rooms').update({ logo_path: null }).eq('id', id)
  if (error) return Response.json({ error: 'הסרת הלוגו נכשלה' }, { status: 500 })
  if (room.logo_path) {
    await supabase.storage.from(LOGO_BUCKET).remove([room.logo_path as string]).catch(() => {})
  }
  return Response.json({ success: true })
}
