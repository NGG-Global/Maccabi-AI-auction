import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff'

/** The projected screens: staff session required, no staff header (the room is watching). */
export default async function LiveLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession()
  if (!session) redirect('/admin/login')
  return <>{children}</>
}
