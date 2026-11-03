import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff'
import StaffHeader from '@/components/admin/StaffHeader'

/** Staff area: every page below needs a staff session (the proxy checks too). */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession()
  if (!session) redirect('/admin/login')
  return (
    <div className="flex min-h-screen flex-col bg-velvet-1" dir="rtl">
      <StaffHeader email={session.email} />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-2 sm:px-6">{children}</main>
    </div>
  )
}
