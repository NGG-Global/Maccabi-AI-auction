'use client'

import { useRef, useState } from 'react'
import { MAX_LOGO_BYTES, logoPublicUrl } from '@/lib/storage/logo'

interface Props {
  roomId: string | null
  logoPath: string | null
  disabled: boolean
  onChange: (logoPath: string | null) => void
}

/** Client logo: PNG, JPG or WEBP up to 2MB, checked again on the server. */
export default function LogoUploader({ roomId, logoPath, disabled, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const url = logoPublicUrl(logoPath)

  async function upload(file: File) {
    if (!roomId) return
    setError(null)
    if (file.size > MAX_LOGO_BYTES) { setError('הלוגו גדול מ-2MB'); return }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('מותרים רק קובצי PNG, JPG או WEBP'); return }
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/admin/rooms/${roomId}/logo`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'העלאה נכשלה'); return }
      onChange(data.logoPath as string)
    } catch { setError('שגיאת רשת') }
    finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove() {
    if (!roomId) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/logo`, { method: 'DELETE' })
      if (!res.ok) { setError('הסרה נכשלה'); return }
      onChange(null)
    } catch { setError('שגיאת רשת') }
    finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-24 h-24 rounded-xl bg-white/90 flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="לוגו הלקוח" className="max-w-full max-h-full object-contain p-1" />
        ) : (
          <span className="text-slate-400 text-xs">ללא לוגו</span>
        )}
      </div>
      <div className="flex flex-col gap-2 text-sm">
        {roomId ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={disabled || busy}
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }}
              className="text-slate-300 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-white file:text-xs file:font-semibold hover:file:bg-slate-600 disabled:opacity-50"
            />
            {url && (
              <button type="button" onClick={remove} disabled={disabled || busy} className="self-start text-red-400 hover:text-red-300 text-xs disabled:opacity-50">
                הסרת הלוגו
              </button>
            )}
          </>
        ) : (
          <p className="text-slate-500 text-xs">שמרו את החדר פעם אחת, ואז יהיה אפשר להעלות לוגו.</p>
        )}
        <p className="text-slate-500 text-xs">PNG, JPG או WEBP, עד 2MB.</p>
        {busy && <p className="text-slate-400 text-xs">מעלה...</p>}
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>
    </div>
  )
}
