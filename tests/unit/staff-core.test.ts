import { describe, expect, it } from 'vitest'
import {
  isNggStaffEmail,
  newStaffSession,
  normalizeEmail,
  secretsMatch,
  signStaffSession,
  verifyStaffSession,
} from '@/lib/auth/staff-core'

const SECRET = 'test-secret-that-is-long-enough'

describe('isNggStaffEmail', () => {
  it('accepts NGG addresses regardless of case and surrounding spaces', () => {
    expect(isNggStaffEmail('dor_va@nggconsult.com')).toBe(true)
    expect(isNggStaffEmail('  Rami_J@NGGConsult.COM ')).toBe(true)
  })
  it('rejects other domains, look-alikes and malformed input', () => {
    expect(isNggStaffEmail('someone@gmail.com')).toBe(false)
    expect(isNggStaffEmail('x@nggconsult.com.evil.com')).toBe(false)
    expect(isNggStaffEmail('x@sub.nggconsult.com')).toBe(false)
    expect(isNggStaffEmail('nggconsult.com')).toBe(false)
    expect(isNggStaffEmail('@nggconsult.com')).toBe(false)
    expect(isNggStaffEmail('')).toBe(false)
    expect(isNggStaffEmail(null)).toBe(false)
    expect(isNggStaffEmail(42)).toBe(false)
  })
  it('normalizes to lower case', () => {
    expect(normalizeEmail(' A@NGGconsult.com ')).toBe('a@nggconsult.com')
  })
})

describe('secretsMatch', () => {
  it('matches equal strings and rejects different ones of any length', async () => {
    expect(await secretsMatch('correct horse', 'correct horse')).toBe(true)
    expect(await secretsMatch('correct horse', 'correct horsE')).toBe(false)
    expect(await secretsMatch('', 'x')).toBe(false)
    expect(await secretsMatch('a-much-longer-password', 'short')).toBe(false)
  })
})

describe('staff session tokens', () => {
  it('round-trips a signed session', async () => {
    const session = newStaffSession('Dor_va@nggconsult.com', 1_000_000)
    const token = await signStaffSession(session, SECRET)
    const verified = await verifyStaffSession(token, SECRET, 1_000_001)
    expect(verified).toEqual({ email: 'dor_va@nggconsult.com', iat: 1_000_000, exp: session.exp })
  })
  it('rejects a token signed with another secret', async () => {
    const token = await signStaffSession(newStaffSession('a@nggconsult.com'), SECRET)
    expect(await verifyStaffSession(token, 'another-secret-also-long-enough')).toBeNull()
  })
  it('rejects a tampered payload', async () => {
    const token = await signStaffSession(newStaffSession('a@nggconsult.com', 1_000_000), SECRET)
    const [payload, sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ email: 'b@nggconsult.com', iat: 1_000_000, exp: 9_999_999_999 }))
      .toString('base64url')
    expect(await verifyStaffSession(`${forged}.${sig}`, SECRET)).toBeNull()
    expect(await verifyStaffSession(`${payload}.${sig}x`, SECRET)).toBeNull()
    expect(await verifyStaffSession(payload, SECRET)).toBeNull()
    expect(await verifyStaffSession('', SECRET)).toBeNull()
    expect(await verifyStaffSession(undefined, SECRET)).toBeNull()
  })
  it('rejects an expired token and a non-staff e-mail inside a valid signature', async () => {
    const session = newStaffSession('a@nggconsult.com', 1_000_000)
    const token = await signStaffSession(session, SECRET)
    expect(await verifyStaffSession(token, SECRET, session.exp)).toBeNull()
    const outsider = await signStaffSession({ email: 'a@gmail.com', iat: 1, exp: 9_999_999_999 }, SECRET)
    expect(await verifyStaffSession(outsider, SECRET)).toBeNull()
  })
  it('refuses to sign with a short secret', async () => {
    await expect(signStaffSession(newStaffSession('a@nggconsult.com'), 'short')).rejects.toThrow()
  })
})
