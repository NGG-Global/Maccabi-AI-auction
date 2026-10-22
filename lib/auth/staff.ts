import 'server-only'
import { cookies } from 'next/headers'
import {
  STAFF_COOKIE_NAME,
  STAFF_SESSION_SECONDS,
  newStaffSession,
  signStaffSession,
  verifyStaffSession,
  type StaffSession,
} from './staff-core'

/**
 * Staff session helpers for server components and route handlers.
 *
 * The proxy (proxy.ts) already turns away requests to /admin and /api/admin
 * without a valid cookie. Every handler still calls requireStaff() itself:
 * the proxy is a convenience layer, not the only gate.
 */

function sessionSecret(): string {
  const secret = process.env.NGG_SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('NGG_SESSION_SECRET is missing or shorter than 16 characters')
  }
  return secret
}

export function staffAuthConfigured(): boolean {
  return Boolean(process.env.NGG_STAFF_PASSWORD) && Boolean(process.env.NGG_SESSION_SECRET)
}

/** The current staff session, or null when the cookie is missing, tampered with or expired. */
export async function getStaffSession(): Promise<StaffSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(STAFF_COOKIE_NAME)?.value
  if (!token || !process.env.NGG_SESSION_SECRET) return null
  return verifyStaffSession(token, process.env.NGG_SESSION_SECRET)
}

/** Same as getStaffSession, for route handlers that answer 401 when it is null. */
export async function requireStaff(): Promise<StaffSession | null> {
  return getStaffSession()
}

export async function setStaffCookie(email: string): Promise<StaffSession> {
  const session = newStaffSession(email)
  const token = await signStaffSession(session, sessionSecret())
  const cookieStore = await cookies()
  cookieStore.set(STAFF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STAFF_SESSION_SECONDS,
    path: '/',
  })
  return session
}

export async function clearStaffCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(STAFF_COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' })
}
