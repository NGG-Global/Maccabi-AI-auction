'use client'

import { useRef, useState } from 'react'
import { MAX_LOGO_BYTES, logoPublicUrl } from '@/lib/storage/logo'
import { Button, ErrorText, Hint } from '@/components/game/ui'

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
    if (file.size > MAX_LOGO_BYTES) { setError('הלוגו גדול מ־2MB.'); return }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('מותרים רק קובצי PNG, JPG או WEBP.'); return }
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/admin/rooms/${roomId}/logo`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'ההעלאה נכשלה.'); return }
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
      if (!res.ok) { setError('ההסרה נכשלה.'); return }
      onChange(null)
    } catch { setError('שגיאת רשת') }
    finally { setBusy(false) }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-[68px] w-[150px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] border-[2.5px] border-dashed border-muted-outline bg-card text-[13px] text-ink-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="לוגו הלקוח" className="h-full w-full bg-card object-contain p-1" />
        ) : (
          'לוגו הלקוח'
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={disabled || busy || !roomId}
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }}
          aria-label="בחירת קובץ לוגו"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => inputRef.current?.click()} disabled={disabled || busy || !roomId}>
            {busy ? 'מעלים…' : url ? 'החלפת הלוגו' : 'העלאת לוגו'}
          </Button>
          {url && (
            <button type="button" onClick={remove} disabled={disabled || busy} className="text-[14px] font-semibold text-ink-2 underline decoration-ink/30 underline-offset-4 hover:text-ink disabled:opacity-50">
              הסרת הלוגו
            </button>
          )}
        </div>
        <Hint>
          {roomId ? 'PNG, JPG או WEBP, עד 2MB. יוצג בפינת המסך המוקרן ובטלפונים.' : 'שומרים את הסשן פעם אחת, ואז אפשר להעלות לוגו.'}
        </Hint>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </div>
  )
}
