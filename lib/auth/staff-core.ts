/**
 * Staff authentication primitives: pure functions with no Next.js
 * dependencies, so they run in the proxy (which cannot rely on Node-only
 * modules), in route handlers and in unit tests alike. Only Web Crypto is
 * used.
 *
 * A session is a signed token `base64url(payload).base64url(hmac)` where
 * payload = { email, iat, exp } and the HMAC-SHA256 key is NGG_SESSION_SECRET.
 */

export const STAFF_COOKIE_NAME = 'ngg_staff_session'
export const STAFF_EMAIL_DOMAIN = 'nggconsult.com'
/** Staff cookies live 30 days; a facilitator should not be logged out mid-season. */
export const STAFF_SESSION_SECONDS = 30 * 24 * 60 * 60

export interface StaffSession {
  email: string
  /** issued at, seconds since epoch */
  iat: number
  /** expires at, seconds since epoch */
  exp: number
}

export function normalizeEmail(input: unknown): string {
  return typeof input === 'string' ? input.trim().toLowerCase() : ''
}

/** True only for a well-formed address on the NGG domain (case-insensitive, trimmed). */
export function isNggStaffEmail(input: unknown): boolean {
  const email = normalizeEmail(input)
  const at = email.lastIndexOf('@')
  if (at <= 0) return false
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (domain !== STAFF_EMAIL_DOMAIN) return false
  return /^[a-z0-9._%+-]+$/.test(local)
}

// ─── Encoding helpers ────────────────────────────────────────────────────────

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** Constant-time comparison of two byte arrays. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/**
 * Constant-time comparison of two strings via their SHA-256 digests, so the
 * comparison takes the same time whatever the lengths and contents.
 */
export async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  return constantTimeEqual(new Uint8Array(a), new Uint8Array(b))
}

// ─── HMAC session tokens ─────────────────────────────────────────────────────

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signStaffSession(
  session: StaffSession,
  secret: string,
): Promise<string> {
  if (!secret || secret.length < 16) throw new Error('NGG_SESSION_SECRET must be at least 16 characters')
  const payload = toBase64Url(encoder.encode(JSON.stringify(session)))
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return `${payload}.${toBase64Url(new Uint8Array(sig))}`
}

/** Returns the session when the token is well-formed, correctly signed and not expired. */
export async function verifyStaffSession(
  token: string | undefined | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<StaffSession | null> {
  if (!token || !secret) return null
  const dot = token.indexOf('.')
  if (dot <= 0 || token.indexOf('.', dot + 1) !== -1) return null
  const payload = token.slice(0, dot)
  const sigBytes = fromBase64Url(token.slice(dot + 1))
  if (!sigBytes) return null

  const key = await hmacKey(secret)
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)))
  if (!constantTimeEqual(expected, sigBytes)) return null

  const payloadBytes = fromBase64Url(payload)
  if (!payloadBytes) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(decoder.decode(payloadBytes))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const { email, iat, exp } = parsed as Record<string, unknown>
  if (typeof email !== 'string' || typeof iat !== 'number' || typeof exp !== 'number') return null
  if (!isNggStaffEmail(email)) return null
  if (exp <= nowSeconds) return null
  return { email, iat, exp }
}

export function newStaffSession(email: string, nowSeconds: number = Math.floor(Date.now() / 1000)): StaffSession {
  return { email: normalizeEmail(email), iat: nowSeconds, exp: nowSeconds + STAFF_SESSION_SECONDS }
}
