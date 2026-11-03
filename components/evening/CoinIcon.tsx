import { useId } from 'react'

interface Props {
  size?: number
  /** A small stack of coins (used on the "sent" screen). */
  stack?: boolean
  className?: string
}

/** A brass coin. Decorative only: always aria-hidden, gradient ids unique per instance. */
export default function CoinIcon({ size = 24, stack = false, className }: Props) {
  const id = useId().replace(/:/g, '')
  const g = `cg-${id}`
  const gd = `cgd-${id}`
  const defs = (
    <defs>
      <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f6dcae" />
        <stop offset=".5" stopColor="#cf9a62" />
        <stop offset="1" stopColor="#8a5c3b" />
      </linearGradient>
      <linearGradient id={gd} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a87346" />
        <stop offset="1" stopColor="#6e4629" />
      </linearGradient>
    </defs>
  )

  if (stack) {
    return (
      <svg viewBox="0 0 56 48" width={size} height={Math.round((size * 48) / 56)} className={className} aria-hidden="true" focusable="false">
        {defs}
        <ellipse cx="22" cy="40" rx="17" ry="6" fill={`url(#${gd})`} />
        <ellipse cx="22" cy="37" rx="17" ry="6" fill={`url(#${g})`} />
        <ellipse cx="22" cy="33" rx="17" ry="6" fill={`url(#${gd})`} />
        <ellipse cx="22" cy="30" rx="17" ry="6" fill={`url(#${g})`} />
        <ellipse cx="22" cy="26" rx="17" ry="6" fill={`url(#${gd})`} />
        <ellipse cx="22" cy="23" rx="17" ry="6" fill={`url(#${g})`} />
        <circle cx="38" cy="18" r="15" fill={`url(#${g})`} stroke="#6e4629" strokeWidth="1.2" />
        <circle cx="38" cy="18" r="10.5" fill="none" stroke="#fff3dc" strokeOpacity=".5" strokeWidth="1.5" />
        <path d="M34 14v7.5h6.5M42 21.5V14h-6.5" stroke="#7a4f30" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      {defs}
      <circle cx="12" cy="12" r="10.5" fill={`url(#${g})`} stroke="#6e4629" strokeWidth="1" />
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="#fff3dc" strokeOpacity=".45" strokeWidth="1.2" />
      <path d="M9 9.5v5h4.5M15 14.5v-5h-4.5" stroke="#7a4f30" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}
