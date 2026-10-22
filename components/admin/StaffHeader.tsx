'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
    <header className="flex items-center justify-between gap-4 px-6 py-3 bg-slate-900/80 border-b border-white/10">
      <Link href="/admin" className="text-white font-black text-lg">🏷️ חדרי מכירה פומבית · NGG</Link>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-400 hidden sm:inline">{email}</span>
        <button
          onClick={logout}
          disabled={busy}
          className="rounded-lg border border-white/10 bg-slate-800/60 hover:bg-slate-700 px-3 py-1.5 text-slate-200 font-semibold transition-colors disabled:opacity-50"
        >
          התנתקות
        </button>
      </div>
    </header>
  )
}
