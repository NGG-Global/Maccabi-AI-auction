'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'

interface Props {
  slug: string
  /** 'floating': subtle corner controls (projection screen). 'inline': compact buttons for a toolbar (admin header). */
  variant?: 'floating' | 'inline'
}

type CopyState = 'idle' | 'copied' | 'failed'

const CONTROL_STYLES = {
  floating: {
    wrapper: 'fixed bottom-6 left-6 z-40 flex gap-3 opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity',
    button: 'glass rounded-2xl px-5 py-3 text-white text-lg font-semibold hover:bg-white/10 transition-colors',
    copyMinWidth: 'min-w-44',
  },
  inline: {
    wrapper: 'flex items-center gap-2',
    button: 'rounded-lg border border-white/10 bg-slate-800/60 hover:bg-slate-700 px-3 py-1.5 text-sm text-slate-200 font-semibold transition-colors',
    copyMinWidth: 'min-w-32',
  },
} as const

/**
 * Controls for letting people join: a full-screen QR code overlay and a
 * copy-link button. The QR is generated locally, so it works without any
 * external service.
 */
export default function JoinShare({ slug, variant = 'floating' }: Props) {
  const joinUrl = useMemo(
    () => `${window.location.origin}/join?event=${encodeURIComponent(slug)}`,
    [slug],
  )
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toString(joinUrl, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' })
      .then(svg => { if (!cancelled) setQrSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`) })
      .catch(err => console.error('QR generation failed:', err))
    return () => { cancelled = true }
  }, [joinUrl])

  useEffect(() => {
    if (!showQr) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowQr(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showQr])

  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current) }, [])

  async function copyLink() {
    let ok = false
    try {
      await navigator.clipboard.writeText(joinUrl)
      ok = true
    } catch {
      // Clipboard API is unavailable outside secure contexts — fall back to a hidden textarea.
      const ta = document.createElement('textarea')
      ta.value = joinUrl
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { ok = document.execCommand('copy') } catch { ok = false }
      document.body.removeChild(ta)
    }
    setCopyState(ok ? 'copied' : 'failed')
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopyState('idle'), 2500)
  }

  const styles = CONTROL_STYLES[variant]

  const copyLabel =
    copyState === 'copied' ? 'הקישור הועתק ✓' :
    copyState === 'failed' ? 'ההעתקה נכשלה' :
    'העתקת קישור'

  return (
    <>
      {/* Facilitator controls — the floating variant stays subtle so it doesn't distract the room */}
      <div className={styles.wrapper}>
        <button
          type="button"
          onClick={() => setShowQr(true)}
          className={styles.button}
        >
          📱 קוד QR להצטרפות
        </button>
        <button
          type="button"
          onClick={copyLink}
          className={`${styles.button} ${styles.copyMinWidth}`}
        >
          {copyState === 'idle' ? '🔗 ' : ''}{copyLabel}
        </button>
      </div>

      {showQr && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center px-8 py-[3vh] overflow-y-auto animate-fade-in"
          onClick={() => setShowQr(false)}
          role="dialog"
          aria-modal="true"
          aria-label="קוד QR להצטרפות"
        >
          <div className="flex flex-col items-center text-center" onClick={e => e.stopPropagation()}>
            <h2 className="text-[min(3.75rem,7vh)] leading-tight font-black text-white mb-[1vh]">סרקו כדי להצטרף</h2>
            <p className="text-[min(1.5rem,3.2vh)] text-slate-400 mb-[3vh]">פתחו את המצלמה בטלפון וכוונו אל הקוד</p>

            <div className="bg-white rounded-3xl p-[2vh] shadow-2xl">
              {qrSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- locally generated data URL, nothing to optimise
                <img
                  src={qrSrc}
                  alt={`קוד QR לקישור ${joinUrl}`}
                  className="block w-[min(52vh,80vw)] h-[min(52vh,80vw)]"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <div className="w-[min(52vh,80vw)] h-[min(52vh,80vw)] flex items-center justify-center text-slate-500 text-2xl">
                  טוען קוד…
                </div>
              )}
            </div>

            <p className="mt-[3vh] text-[min(1.25rem,2.8vh)] text-slate-400">או היכנסו לקישור:</p>
            <p dir="ltr" className="text-[min(1.875rem,4vh)] font-bold text-amber-400 break-all select-all mt-1">{joinUrl}</p>

            <div className="flex gap-4 mt-[3vh]">
              <button
                type="button"
                onClick={copyLink}
                className="bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-2xl px-8 py-4 text-xl font-black transition-colors min-w-52"
              >
                {copyLabel}
              </button>
              <button
                type="button"
                onClick={() => setShowQr(false)}
                className="glass rounded-2xl px-8 py-4 text-xl font-semibold text-white hover:bg-white/10 transition-colors"
              >
                סגירה
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
