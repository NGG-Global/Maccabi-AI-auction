/**
 * Join-URL slugs. Hebrew titles do not transliterate well, so a slug is
 * built from the Latin letters and digits of the title when there are any,
 * and from a short random suffix otherwise. The facilitator can always
 * edit it in the room form.
 */

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length >= 3 && slug.length <= 60
}

/** Lower-cases, keeps [a-z0-9], collapses everything else into single dashes. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

export function randomSlugSuffix(length = 6): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

/** A suggested slug for a new room: from the title when it yields one, otherwise `room-xxxxxx`. */
export function suggestSlug(title: string): string {
  const base = slugify(title)
  if (base.length >= 3) return base
  return `room-${randomSlugSuffix()}`
}
