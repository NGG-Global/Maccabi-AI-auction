import { TRAIT_CATEGORIES, type RoomInput, type TraitCategory, type TraitInput } from '@/lib/types'
import { isValidSlug } from './slug'

/**
 * Shape check for the room form payload before it reaches the database.
 * The RPCs re-validate everything; this only turns malformed JSON into a
 * clear 400 instead of a 500.
 */

type ParseResult = { ok: true; value: RoomInput } | { ok: false; error: string }

export function parseTraits(raw: unknown): { ok: true; value: TraitInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'רשימת ההיגדים חסרה' }
  if (raw.length === 0) return { ok: false, error: 'יש להוסיף לפחות היגד אחד' }
  if (raw.length > 50) return { ok: false, error: 'עד 50 היגדים לחדר' }
  const traits: TraitInput[] = []
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i] as Record<string, unknown> | null
    if (!t || typeof t !== 'object') return { ok: false, error: 'היגד לא תקין' }
    const title = typeof t.title === 'string' ? t.title.trim() : ''
    if (title.length < 2 || title.length > 120) return { ok: false, error: `היגד ${i + 1}: הטקסט חייב להכיל 2 עד 120 תווים` }
    const category = t.category
    if (!TRAIT_CATEGORIES.includes(category as TraitCategory)) return { ok: false, error: `היגד ${i + 1}: יש לבחור קטגוריה` }
    const description = typeof t.description === 'string' ? t.description.trim().slice(0, 500) : ''
    const id = typeof t.id === 'string' && /^[0-9a-f-]{36}$/i.test(t.id) ? t.id : undefined
    traits.push({ id, title, description, category: category as TraitCategory, sort_order: i + 1 })
  }
  return { ok: true, value: traits }
}

export function parseRoomInput(body: unknown, opts: { requireTraits: boolean }): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>
  const title = typeof b.title === 'string' ? b.title.trim() : ''
  if (title.length < 2 || title.length > 120) return { ok: false, error: 'הכותרת חייבת להכיל 2 עד 120 תווים' }

  const slug = typeof b.slug === 'string' ? b.slug.trim().toLowerCase() : ''
  if (!isValidSlug(slug)) return { ok: false, error: 'כתובת ההצטרפות (slug) חייבת להכיל אותיות לטיניות קטנות, ספרות ומקפים, 3 עד 60 תווים' }

  const client_name = typeof b.client_name === 'string' ? b.client_name.trim().slice(0, 120) : ''

  const game_mode = b.game_mode
  if (game_mode !== 'auction' && game_mode !== 'allocation') return { ok: false, error: 'יש לבחור סוג משחק' }

  const starting_coins = Number(b.starting_coins)
  if (!Number.isInteger(starting_coins) || starting_coins < 1 || starting_coins > 1_000_000) {
    return { ok: false, error: 'מספר המטבעות ההתחלתי חייב להיות מספר שלם בין 1 ל-1,000,000' }
  }

  let default_round_seconds: number | null = null
  if (b.default_round_seconds !== null && b.default_round_seconds !== undefined && b.default_round_seconds !== '') {
    const n = Number(b.default_round_seconds)
    if (!Number.isInteger(n) || n < 10 || n > 3600) return { ok: false, error: 'משך הסבב חייב להיות בין 10 ל-3,600 שניות' }
    default_round_seconds = n
  }

  let traits: TraitInput[] | null = null
  if (b.traits !== null && b.traits !== undefined) {
    const parsed = parseTraits(b.traits)
    if (!parsed.ok) return parsed
    traits = parsed.value
  } else if (opts.requireTraits) {
    return { ok: false, error: 'יש להוסיף לפחות היגד אחד' }
  }

  return { ok: true, value: { slug, title, client_name, game_mode, starting_coins, default_round_seconds, traits } }
}
