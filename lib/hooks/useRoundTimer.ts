'use client'

import { useEffect, useState } from 'react'

export interface RoundTimer {
  /** m:ss since the round opened */
  elapsed: string
  /** m:ss left of the room's default round length, or null when none is set */
  remaining: string | null
  /** true once the default round length has passed (display only; closing stays manual) */
  overtime: boolean
  remainingSeconds: number | null
}

function format(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function computeRoundTimer(openedAt: string | null, active: boolean, roundSeconds: number | null, now: number): RoundTimer {
  if (!openedAt || !active) return { elapsed: '0:00', remaining: roundSeconds ? format(roundSeconds * 1000) : null, overtime: false, remainingSeconds: roundSeconds }
  const elapsedMs = Math.max(0, now - new Date(openedAt).getTime())
  if (!roundSeconds) return { elapsed: format(elapsedMs), remaining: null, overtime: false, remainingSeconds: null }
  const leftMs = roundSeconds * 1000 - elapsedMs
  return {
    elapsed: format(elapsedMs),
    remaining: format(Math.max(0, leftMs)),
    overtime: leftMs <= 0,
    remainingSeconds: Math.max(0, Math.ceil(leftMs / 1000)),
  }
}

/**
 * Elapsed time of an open round and, when the room defines a default round
 * length, a countdown. The countdown is a cue for the facilitator and the
 * room: the server never closes a round on its own.
 */
export function useRoundTimer(openedAt: string | null, active: boolean, roundSeconds: number | null): RoundTimer {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!openedAt || !active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [openedAt, active])
  return computeRoundTimer(openedAt, active, roundSeconds, now)
}
