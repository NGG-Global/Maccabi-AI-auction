import { useId } from 'react'

interface Props {
  size?: number
  /** A small stack of coins (used on the "sent" screen). */
  stack?: boolean
  className?: string
}

/** A sunflower coin with an ink outline. Decorative only: always aria-hidden, gradient ids unique per instance. */
export default function CoinIcon({ size = 24, stack = false, className }: Props) {
  const id = useId().replace(/:/g, '')
  const g = `cg-${id}`
  const defs = (
    <defs>
      <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffe08a" />
        <stop offset=".55" stopColor="#ffc83d" />
        <stop offset="1" stopColor="#f0a800" />
      </linearGradient>
    </defs>
  )

  if (stack) {
    return (
      <svg viewBox="0 0 56 48" width={size} height={Math.round((size * 48) / 56)} className={className} aria-hidden="true" focusable="false">
        {defs}
        {[40, 34, 28, 22].map(cy => (
          <ellipse key={cy} cx="22" cy={cy} rx="17" ry="6" fill={`url(#${g})`} stroke="#1f2a37" strokeWidth="2" />
        ))}
        <circle cx="38" cy="18" r="15" fill={`url(#${g})`} stroke="#1f2a37" strokeWidth="2.2" />
        <circle cx="38" cy="18" r="10" fill="none" stroke="#fff7d6" strokeOpacity=".8" strokeWidth="1.5" />
        <rect x="34" y="14" width="8" height="8" rx="1.5" fill="none" stroke="#1f2a37" strokeWidth="2" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      {defs}
      <circle cx="12" cy="12" r="10.5" fill={`url(#${g})`} stroke="#1f2a37" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="#fff7d6" strokeOpacity=".85" strokeWidth="1.2" />
      <rect x="9.3" y="9.3" width="5.4" height="5.4" rx="1" fill="none" stroke="#1f2a37" strokeWidth="1.5" />
    </svg>
  )
}
