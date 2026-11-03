'use client'

import { useEffect, useState } from 'react'
import { fmt } from './units'

interface Props {
  value: number
  className?: string
  /** Text appended after the digits (for example "₪"). */
  suffix?: string
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

function Digit({ digit }: { digit: number }) {
  // Paint at 0 first so the first value rolls in; later values roll from the previous digit.
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(digit))
    return () => cancelAnimationFrame(id)
  }, [digit])
  return (
    <span className="d" aria-hidden="true">
      <span className="strip" style={{ transform: `translateY(-${shown}em)` }}>
        {DIGITS.map(d => <span key={d}>{d}</span>)}
      </span>
    </span>
  )
}

/**
 * Animated digits: each digit is a 1em window over a 0–9 strip that
 * slides to the digit. The strips are rebuilt when the digit count
 * changes. Reduced motion is handled by the global transition override.
 */
export default function NumberRoller({ value, className, suffix }: Props) {
  const text = fmt(Math.max(0, Math.round(value)))
  const chars = [...text]
  return (
    <span className={`roller ${className ?? ''}`} role="img" aria-label={suffix ? `${text} ${suffix}` : text}>
      {chars.map((ch, i) =>
        /\d/.test(ch)
          ? <Digit key={`${chars.length}-${i}`} digit={Number(ch)} />
          : <span key={`${chars.length}-${i}`} className="sep" aria-hidden="true">{ch}</span>,
      )}
      {suffix && <span className="sep" aria-hidden="true">&nbsp;{suffix}</span>}
    </span>
  )
}
