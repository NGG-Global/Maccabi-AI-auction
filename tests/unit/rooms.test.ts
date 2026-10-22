import { describe, expect, it } from 'vitest'
import { isValidSlug, slugify, suggestSlug } from '@/lib/rooms/slug'
import { parseRoomInput, parseTraits } from '@/lib/rooms/validate'

describe('slugs', () => {
  it('slugifies Latin titles and validates the result', () => {
    expect(slugify('Leadership Workshop, Group 3!')).toBe('leadership-workshop-group-3')
    expect(isValidSlug('leadership-workshop-group-3')).toBe(true)
    expect(isValidSlug('Bad Slug')).toBe(false)
    expect(isValidSlug('ab')).toBe(false)
    expect(isValidSlug('-leading')).toBe(false)
  })
  it('falls back to a random room slug for Hebrew titles', () => {
    const s = suggestSlug('סדנת מנהיגות')
    expect(s).toMatch(/^room-[a-z0-9]{6}$/)
    expect(isValidSlug(s)).toBe(true)
  })
})

describe('parseRoomInput', () => {
  const base = {
    title: 'חדר', slug: 'room-a', client_name: 'לקוח', game_mode: 'auction', starting_coins: 1000,
    default_round_seconds: 90,
    traits: [{ title: 'היגד', category: 'מנהיגות' }],
  }
  it('accepts a valid payload and numbers the statements', () => {
    const r = parseRoomInput(base, { requireTraits: true })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.traits?.[0]).toMatchObject({ title: 'היגד', category: 'מנהיגות', sort_order: 1 })
      expect(r.value.default_round_seconds).toBe(90)
    }
  })
  it('rejects a missing category, bad coins, bad slug and bad round length', () => {
    expect(parseTraits([{ title: 'היגד', category: 'אחר' }]).ok).toBe(false)
    expect(parseTraits([{ title: 'x', category: 'מנהיגות' }]).ok).toBe(false)
    expect(parseRoomInput({ ...base, starting_coins: 0 }, { requireTraits: true }).ok).toBe(false)
    expect(parseRoomInput({ ...base, starting_coins: 10.5 }, { requireTraits: true }).ok).toBe(false)
    expect(parseRoomInput({ ...base, slug: 'Bad Slug' }, { requireTraits: true }).ok).toBe(false)
    expect(parseRoomInput({ ...base, default_round_seconds: 5 }, { requireTraits: true }).ok).toBe(false)
    expect(parseRoomInput({ ...base, game_mode: 'lottery' }, { requireTraits: true }).ok).toBe(false)
  })
  it('allows omitting statements on update (locked rooms) but not on create', () => {
    const { traits: _ignored, ...noTraits } = base
    void _ignored
    expect(parseRoomInput(noTraits, { requireTraits: true }).ok).toBe(false)
    const r = parseRoomInput(noTraits, { requireTraits: false })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.traits).toBeNull()
  })
  it('treats an empty round length as none', () => {
    const r = parseRoomInput({ ...base, default_round_seconds: '' }, { requireTraits: true })
    expect(r.ok && r.value.default_round_seconds).toBeNull()
  })
})
