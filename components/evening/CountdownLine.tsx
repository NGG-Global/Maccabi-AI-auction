import type { RoundTimer } from '@/lib/hooks/useRoundTimer'

interface Props {
  timer: RoundTimer
  roundSeconds: number | null
  /** The round is closed: the fill is empty and the time reads "נסגר". */
  closed?: boolean
  /** Projector sizes (default) or compact phone sizes. */
  size?: 'projector' | 'phone'
}

/**
 * A 4px track with a vermilion fill and an ember head that shrinks over
 * the round's seconds. Closing always stays manual: at 0 the line waits.
 */
export default function CountdownLine({ timer, roundSeconds, closed = false, size = 'projector' }: Props) {
  const hasCountdown = roundSeconds !== null && roundSeconds > 0
  const pct = closed ? 0 : !hasCountdown ? 100 : Math.max(0, Math.min(100, ((timer.remainingSeconds ?? 0) / roundSeconds) * 100))
  const label = closed ? 'נסגר' : hasCountdown ? (timer.overtime ? 'הזמן נגמר · ממתינים לסגירת הסבב' : 'הזמן בסבב') : 'הזמן בסבב'
  const time = closed ? null : hasCountdown ? (timer.overtime ? null : timer.remaining) : timer.elapsed
  const big = size === 'projector'
  return (
    <div>
      <div className={`fuse ${closed ? 'done' : ''}`} aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      <div className={`flex items-center justify-between ${big ? 'mt-[14px] text-[24px]' : 'mt-2 text-[14px]'} text-ivory-dim`}>
        <span>{label}</span>
        {time && <span className={`num text-ivory ${big ? 'text-[30px]' : 'text-[18px]'}`}>{time}</span>}
      </div>
    </div>
  )
}
