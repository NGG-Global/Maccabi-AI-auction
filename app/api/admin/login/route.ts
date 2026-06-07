import { NextRequest } from 'next/server'
import { checkAdminPassword, setAdminSession } from '@/lib/auth/admin'

// In-memory brute-force protection.
// Keyed by IP; values are { failures, lockedUntil }.
// In a multi-instance deployment replace with a shared Redis store.
const loginAttempts = new Map<string, { failures: number; lockedUntil: number }>()

const MAX_FAILURES = 5
const LOCKOUT_MS   = 5 * 60 * 1000 // 5 minutes

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const now = Date.now()
  const record = loginAttempts.get(ip)

  // Check lockout
  if (record && record.lockedUntil > now) {
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000)
    return Response.json(
      { error: `יותר מדי ניסיונות. נסה שוב בעוד ${remainingSec} שניות.` },
      { status: 429 },
    )
  }

  const body = await req.json().catch(() => null)

  if (!body?.password) {
    return Response.json({ error: 'סיסמה חסרה' }, { status: 400 })
  }

  if (!checkAdminPassword(body.password)) {
    const failures = (record?.failures ?? 0) + 1
    const lockedUntil = failures >= MAX_FAILURES ? now + LOCKOUT_MS : 0
    loginAttempts.set(ip, { failures, lockedUntil })
    return Response.json({ error: 'סיסמה שגויה' }, { status: 401 })
  }

  // Success — clear failure record for this IP
  loginAttempts.delete(ip)
  await setAdminSession()
  return Response.json({ success: true })
}
