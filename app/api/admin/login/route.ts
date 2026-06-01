import { NextRequest } from 'next/server'
import { checkAdminPassword, setAdminSession } from '@/lib/auth/admin'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  if (!body?.password) {
    return Response.json({ error: 'סיסמה חסרה' }, { status: 400 })
  }

  if (!checkAdminPassword(body.password)) {
    return Response.json({ error: 'סיסמה שגויה' }, { status: 401 })
  }

  await setAdminSession()
  return Response.json({ success: true })
}
