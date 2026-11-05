'use client'

import CoinIcon from './CoinIcon'
import NumberRoller from './NumberRoller'
import ParticipantMark from './ParticipantMark'
import { fmt } from './units'

interface Props {
  remaining: number
  total: number
  unitLabel: string
  /** "נשארו לך" (auction) or "נשארו לך לחלק" (allocation). */
  label: string
  name?: string | null
  /** `card` (white) or `tint` (the sunflower tint, for the result screen). */
  variant?: 'card' | 'tint'
  className?: string
}

/**
 * The single wallet row at the top of the phone: coin, label + rolling
 * number + unit, the participant's token and name, and a 7px sunflower
 * meter of remaining / total anchored to the start edge.
 */
export default function WalletBar({ remaining, total, unitLabel, label, name, variant = 'card', className }: Props) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0
  return (
    <div
      className={`relative flex items-center gap-3 rounded-[24px] border-[3px] border-ink px-4 pb-[18px] pt-3 text-ink shadow-piece-md ${
        variant === 'tint' ? 'bg-sun-tint' : 'bg-card'
      } ${className ?? ''}`}
    >
      <CoinIcon size={34} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <small className="block text-[14px] leading-tight text-ink-3">{label}</small>
        <span className="flex items-baseline gap-1.5">
          <NumberRoller value={remaining} className="text-[34px] font-bold leading-[1.05]" />
          <span className="text-[15px] font-semibold text-ink-2">{unitLabel}</span>
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-end">
        {name && (
          <span className="inline-flex items-center gap-2 text-[17px] font-semibold">
            <ParticipantMark name={name} size={30} tone="ink" />
            <span className="max-w-[9rem] truncate">{name}</span>
          </span>
        )}
        <small className="text-[14px] text-ink-3">
          מתוך <span className="num">{fmt(total)}</span>
        </small>
      </div>
      <div aria-hidden="true" className="absolute inset-x-4 bottom-[7px] h-[7px] overflow-hidden rounded-full bg-meter">
        <i className="block h-full rounded-full bg-sun transition-[width] duration-500 ease-[var(--ease-out-expo)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
