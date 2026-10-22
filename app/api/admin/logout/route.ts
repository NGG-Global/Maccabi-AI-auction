import { clearStaffCookie } from '@/lib/auth/staff'

export async function POST() {
  await clearStaffCookie()
  return Response.json({ success: true })
}
