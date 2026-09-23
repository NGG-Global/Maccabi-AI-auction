import { cookies } from 'next/headers'

const COOKIE_NAME = 'auction_admin_session'
const SESSION_VALUE = 'authenticated'

export async function isAdminAuthenticated(): Promise<boolean> {
  // No password required — admin route is open to anyone with the URL.
  return true
}

export async function setAdminSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
