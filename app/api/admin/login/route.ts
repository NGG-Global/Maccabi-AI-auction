import { NextRequest } from 'next/server'
import { setAdminSession } from '@/lib/auth/admin'

export async function POST(_req: NextRequest) {
  await setAdminSession()
  return Response.json({ success: true })
}
