'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { Button, btnClass } from '@/components/evening/ui'

interface Props { slug: string }

type CopyState = 'idle' | 'copied' | 'failed'

/** The join URL of a room and its QR code as a data URL, generated locally. */
export function useJoinQr(slug: string): { joinUrl: string; qrSrc: string | null } {
  const joinUrl = useMemo(
    () => `${window.location.origin}/join?room=${encodeURIComponent(slug)}`,
    [slug],
  )
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    QRCode.toString(joinUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1d1316', light: '#efe5d4' } })
      .then(svg => { if (!cancelled) setQrSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`) })
      .catch(err => console.error('QR generation failed:', err))
    return () => { cancelled = true }
  }, [joinUrl])
  return { joinUrl, qrSrc }
}

/** The paper QR card on the projected screen ("סורקים ונכנסים"). Authored for the 1920 canvas. */
export function JoinQrCard({ slug, className }: { slug: string; className?: string }) {
  const { joinUrl, qrSrc } = useJoinQr(slug)
  const shortUrl = joinUrl.replace(/^https?:\/\//, '')
  return (
    <div className={`flex flex-col items-center gap-[26px] rounded-[20px] bg-paper p-11 text-ink-paper shadow-[0_40px_80px_rgba(0,0,0,.5)] ${className ?? ''}`}>
      <h3 className="m-0 font-display text-[46px] font-black leading-none">סורקים ונכנסים</h3>
      <div className="relative flex h-[340px] w-[340px] items-center justify-center">
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- locally generated data URL, nothing to optimise
          <img src={qrSrc} alt={`קוד QR לקישור ${joinUrl}`} className="block h-full w-full" style={{ imageRendering: 'pixelated' }} />
        ) : (
          <span className="text-[24px] font-semibold text-ink-soft">טוענים את הקוד…</span>
        )}
      </div>
      <span className="w-full max-w-[432px] break-all text-center text-[22px] leading-[1.3] text-ink-soft" dir="ltr">{shortUrl}</span>
    </div>
  )
}

/**
 * Facilitator controls for letting people join: a full-screen QR code
 * overlay and a copy-link button. The QR is generated locally, so it works
 * without any external service.
 */
export default function JoinShare({ slug }: Props) {
  const { joinUrl, qrSrc } = useJoinQr(slug)
  const [showQr, setShowQr] = useState(false)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const copyLabel =
    copyState === 'copied' ? 'הקישור הועתק' :
    copyState === 'failed' ? 'ההעתקה נכשלה' :
    'העתקת קישור ההצטרפות'

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button size="sm" onClick={() => setShowQr(true)}>קוד QR במסך מלא</Button>
        <Button size="sm" onClick={copyLink}>{copyLabel}</Button>
        <span className="truncate text-[12px] text-ivory-mute" dir="ltr">{joinUrl}</span>
      </div>

      {showQr && createPortal(
        <div
          className="ev-fade fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-velvet-0/95 px-8 py-[3vh]"
          onClick={() => setShowQr(false)}
          role="dialog"
          aria-modal="true"
          aria-label="קוד QR להצטרפות"
        >
          <div className="flex flex-col items-center text-center" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-[2vh] rounded-[24px] bg-paper p-[3vh] text-ink-paper shadow-[0_40px_80px_rgba(0,0,0,.5)]">
              <h2 className="m-0 font-display text-[min(4rem,7vh)] font-black leading-none">סורקים ונכנסים</h2>
              {qrSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- locally generated data URL, nothing to optimise
                <img src={qrSrc} alt={`קוד QR לקישור ${joinUrl}`} className="block h-[min(52vh,80vw)] w-[min(52vh,80vw)]" style={{ imageRendering: 'pixelated' }} />
              ) : (
                <div className="flex h-[min(52vh,80vw)] w-[min(52vh,80vw)] items-center justify-center text-2xl text-ink-soft">טוענים את הקוד…</div>
              )}
              <p dir="ltr" className="m-0 max-w-[min(52vh,80vw)] break-all text-center text-[min(1.6rem,3.4vh)] font-semibold text-ink-soft">{joinUrl.replace(/^https?:\/\//, '')}</p>
            </div>
            <div className="mt-[3vh] flex gap-4">
              <button type="button" onClick={copyLink} className={btnClass('primary', 'md', 'h-14 px-8 text-[18px]')}>{copyLabel}</button>
              <button type="button" onClick={() => setShowQr(false)} className={btnClass('secondary', 'md', 'h-14 px-8 text-[18px]')}>סגירה</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
