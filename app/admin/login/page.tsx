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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError('סיסמה שגויה')
        return
      }
      router.push('/admin')
      router.refresh()
    } catch {
      setError('שגיאת רשת')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">כניסת מנהל</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="סיסמה"
            required
            disabled={loading}
            className="border border-gray-300 rounded-xl px-4 py-3 text-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-gray-900 text-white rounded-xl py-3 font-bold hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>
      </div>
    </main>
  )
}
