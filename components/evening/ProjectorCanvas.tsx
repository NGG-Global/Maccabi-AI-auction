'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  children: React.ReactNode
  className?: string
}

export const STAGE_W = 1920
export const STAGE_H = 1080

/**
 * A 1920×1080 stage scaled uniformly to fit its container and letterboxed
 * on velvet-deepest. Everything inside is authored in px on that canvas,
 * so it never reflows: it only scales.
 */
export default function ProjectorCanvas({ children, className }: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ scale: 1, left: 0, top: 0 })

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const scale = Math.min(width / STAGE_W, height / STAGE_H)
      setFit({ scale, left: (width - STAGE_W * scale) / 2, top: (height - STAGE_H * scale) / 2 })
    })
    ro.observe(frame)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={frameRef} className={`relative h-full w-full overflow-hidden bg-velvet-0 ${className ?? ''}`}>
      <div
        className="stage-atmos absolute top-0 left-0 origin-top-left text-ivory shadow-[var(--shadow-stage)]"
        style={{ position: 'absolute', width: STAGE_W, height: STAGE_H, transform: `scale(${fit.scale})`, left: fit.left, top: fit.top }}
        dir="rtl"
      >
        {children}
      </div>
    </div>
  )
}
