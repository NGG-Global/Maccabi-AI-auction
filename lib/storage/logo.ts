/**
 * Client logos live in a dedicated Supabase Storage bucket. The bucket is
 * public for reads (the logo appears on participant phones and on the
 * projected screen); writes go through /api/admin/rooms/[id]/logo with the
 * service role, after the checks below.
 *
 * Pure helpers only, usable from both server and browser code.
 */

export const LOGO_BUCKET = 'auction-logos'
export const MAX_LOGO_BYTES = 2 * 1024 * 1024

export type LogoImageType = 'png' | 'jpg' | 'webp'

const MIME_BY_TYPE: Record<LogoImageType, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

export function logoMimeType(type: LogoImageType): string {
  return MIME_BY_TYPE[type]
}

/**
 * Identifies the image by its file signature (magic bytes), not by the
 * declared MIME type or extension. SVG is intentionally not accepted.
 */
export function detectLogoImageType(bytes: Uint8Array): LogoImageType | null {
  if (bytes.length < 12) return null
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'png'
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'webp'
  return null
}

export interface LogoCheck {
  ok: boolean
  type: LogoImageType | null
  error: string | null
}

export function checkLogoFile(bytes: Uint8Array): LogoCheck {
  if (bytes.length === 0) return { ok: false, type: null, error: 'הקובץ ריק' }
  if (bytes.length > MAX_LOGO_BYTES) return { ok: false, type: null, error: 'הלוגו גדול מ-2MB' }
  const type = detectLogoImageType(bytes)
  if (!type) return { ok: false, type: null, error: 'מותרים רק קובצי PNG, JPG או WEBP' }
  return { ok: true, type, error: null }
}

/** Object path for a room's logo. A timestamp in the name makes every upload a new URL (no stale caches). */
export function logoObjectPath(roomId: string, type: LogoImageType, now: number = Date.now()): string {
  return `rooms/${roomId}/logo-${now}.${type}`
}

/** Public URL of a stored logo, or null when the room has none. */
export function logoPublicUrl(logoPath: string | null | undefined, supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  if (!logoPath || !supabaseUrl) return null
  const base = supabaseUrl.replace(/\/+$/, '')
  return `${base}/storage/v1/object/public/${LOGO_BUCKET}/${logoPath.split('/').map(encodeURIComponent).join('/')}`
}
