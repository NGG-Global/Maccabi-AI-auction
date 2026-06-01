import { cookies } from 'next/headers'

const COOKIE_NAME = 'auction_admin_session'
const SESSION_VALUE = 'authenticated'

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value === SESSION_VALUE
}

export async function setAdminSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  })
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    console.warn('ADMIN_PASSWORD env var is not set')
    return false
  }
  return password === expected
}
