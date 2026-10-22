import { NextRequest } from 'next/server'
import { isNggStaffEmail, normalizeEmail, secretsMatch } from '@/lib/auth/staff-core'
import { setStaffCookie, staffAuthConfigured } from '@/lib/auth/staff'
import { checkLoginRateLimit, clientIp, recordFailedLogin } from '@/lib/auth/rate-limit'

/**
 * Staff login: e-mail on the NGG domain + the shared staff password.
 * The password check is constant-time; failures are rate-limited per IP
 * and answered with one generic message, so nothing reveals which part
 * was wrong.
 */
export async function POST(req: NextRequest) {
  if (!staffAuthConfigured()) {
    return Response.json({ error: 'כניסת הצוות אינה מוגדרת בשרת (NGG_STAFF_PASSWORD / NGG_SESSION_SECRET)' }, { status: 503 })
  }

  const ip = clientIp(req)
  const limit = await checkLoginRateLimit(ip)
  if (!limit.allowed) {
    return Response.json(
      { error: `יותר מדי ניסיונות כניסה. נסו שוב בעוד ${Math.ceil(limit.retryAfterSeconds / 60)} דקות.` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  const body = await req.json().catch(() => null)
  const email = normalizeEmail(body?.email)
  const password = typeof body?.password === 'string' ? body.password : ''

  const emailOk = isNggStaffEmail(email)
  // Always run the comparison so timing does not depend on the e-mail check.
  const passwordOk = await secretsMatch(password, process.env.NGG_STAFF_PASSWORD!)

  if (!emailOk || !passwordOk || password.length === 0) {
    await recordFailedLogin(ip)
    return Response.json({ error: 'כתובת המייל או הסיסמה שגויים' }, { status: 401 })
  }

  const session = await setStaffCookie(email)
  return Response.json({ success: true, email: session.email })
}
