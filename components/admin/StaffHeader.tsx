'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/evening/ui'

export default function StaffHeader({ email }: { email: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function logout() {
    setBusy(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      router.push('/admin/login')
      router.refresh()
    }
  }

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-3">
      <Link href="/admin" className="flex items-baseline gap-3 no-underline">
        <b className="font-display text-[26px] font-black tracking-[-.01em] text-ivory">ערב מכירה</b>
        <span className="hidden text-[14px] text-ivory-mute sm:inline">ניהול הסשנים · NGG</span>
      </Link>
      <div className="flex items-center gap-3 text-[14px]">
        <span className="hidden text-ivory-mute sm:inline" dir="ltr">{email}</span>
        <Button size="sm" onClick={logout} disabled={busy}>התנתקות</Button>
      </div>
    </header>
  )
}
