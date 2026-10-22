import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff'
import StaffHeader from '@/components/admin/StaffHeader'

/** Staff area: every page below needs a staff session (the proxy checks too). */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession()
  if (!session) redirect('/admin/login')
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <StaffHeader email={session.email} />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  )
}
