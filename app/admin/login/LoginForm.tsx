'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="glass rounded-3xl p-8 w-full max-w-sm animate-scale-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-2xl font-black text-white">כניסת צוות NGG</h1>
          <p className="text-slate-500 text-sm mt-1">ניהול חדרי המכירה הפומבית</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@nggconsult.com"
            autoComplete="username"
            dir="ltr"
            required
            disabled={loading}
            className="w-full bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-2xl px-5 py-3.5 text-lg text-center text-white focus:outline-none transition-colors placeholder:text-slate-600 disabled:opacity-50"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="סיסמת הצוות"
            autoComplete="current-password"
            required
            disabled={loading}
            className="w-full bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-2xl px-5 py-3.5 text-lg text-center text-white focus:outline-none transition-colors placeholder:text-slate-600 disabled:opacity-50"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-slate-900 rounded-2xl py-3.5 text-lg font-black transition-all active:scale-95"
          >
            {loading ? 'נכנס...' : 'כניסה'}
          </button>
        </form>
      </div>
    </main>
  )
}
