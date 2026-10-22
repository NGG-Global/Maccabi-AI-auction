import { NextResponse, type NextRequest } from 'next/server'
import { STAFF_COOKIE_NAME, verifyStaffSession } from '@/lib/auth/staff-core'

/**
 * Gate for the staff area. Every /admin page and /api/admin handler needs a
 * valid staff cookie, except the login screen and the login endpoint.
 *
 * Pages are redirected to the login screen (keeping the requested path);
 * API calls get a 401. Handlers also verify the session themselves
 * (lib/auth/staff.ts), so this file is the first gate, not the only one.
 */

const PUBLIC_PATHS = new Set(['/admin/login', '/api/admin/login'])

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  const token = request.cookies.get(STAFF_COOKIE_NAME)?.value
  const secret = process.env.NGG_SESSION_SECRET ?? ''
  const session = await verifyStaffSession(token, secret)
  if (session) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'נדרשת כניסת צוות' }, { status: 401 })
  }

  const loginUrl = new URL('/admin/login', request.url)
  loginUrl.searchParams.set('next', pathname + search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
