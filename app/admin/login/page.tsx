'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) { setError('סיסמה שגויה'); return }
      router.push('/admin')
      router.refresh()
    } catch { setError('שגיאת רשת') }
    finally { setLoading(false) }
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="glass rounded-3xl p-8 w-full max-w-sm animate-scale-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-2xl font-black text-white">כניסת מנהל</h1>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="סיסמה"
            required
            disabled={loading}
            className="bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-2xl px-5 py-4 text-xl text-center text-white focus:outline-none transition-colors placeholder:text-slate-600 disabled:opacity-50"
          />
          {error && <p className="text-red-400 text-sm text-center animate-slide-in-up">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-slate-900 rounded-2xl py-4 font-black text-lg transition-all active:scale-95"
          >
            {loading ? '...' : 'כניסה'}
          </button>
        </form>
      </div>
    </main>
  )
}
