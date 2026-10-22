import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff'
import LoginForm from './LoginForm'

interface Props {
  searchParams: Promise<{ next?: string }>
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const { next } = await searchParams
  const safeNext = next && next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin'
  if (await getStaffSession()) redirect(safeNext)
  return <LoginForm next={safeNext} />
}
