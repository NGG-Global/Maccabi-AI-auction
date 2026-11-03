'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CoinIcon from '@/components/evening/CoinIcon'
import { ErrorText, FIELD, btnClass } from '@/components/evening/ui'

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'הכניסה נכשלה'); return }
      router.push(next)
      router.refresh()
    } catch { setError('שגיאת רשת') }
    finally { setLoading(false) }
  }

  return (
    <main className="stage-atmos flex min-h-screen items-center justify-center px-4" dir="rtl">
      <div className="ev-rise w-full max-w-sm rounded-[22px] border border-velvet-3 bg-velvet-2 p-8">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <CoinIcon size={44} />
          <h1 className="m-0 font-display text-[34px] font-black leading-none text-ivory">ערב מכירה</h1>
          <p className="m-0 text-[15px] text-ivory-mute">כניסת צוות NGG לניהול הסשנים</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[14px] font-semibold text-ivory-dim">
            דוא״ל
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@nggconsult.com"
              autoComplete="username"
              dir="ltr"
              required
              disabled={loading}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[14px] font-semibold text-ivory-dim">
            סיסמת הצוות
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
              className={FIELD}
            />
          </label>
          {error && <ErrorText>{error}</ErrorText>}
          <button type="submit" disabled={loading || !email || !password} className={btnClass('primary', 'md', 'mt-2 h-12 w-full text-[17px]')}>
            {loading ? 'נכנסים…' : 'כניסה'}
          </button>
        </form>
      </div>
    </main>
  )
}
