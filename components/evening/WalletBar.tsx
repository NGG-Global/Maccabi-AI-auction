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
  variant?: 'dark' | 'light'
  className?: string
}

/**
 * The single wallet row at the top of the phone: coin, label + rolling
 * number + unit, the participant's mark and name, and a 4px meter of
 * remaining / total anchored to the start edge.
 */
export default function WalletBar({ remaining, total, unitLabel, label, name, variant = 'dark', className }: Props) {
  const light = variant === 'light'
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0
  return (
    <div
      className={`relative flex items-center gap-3 rounded-[18px] border px-4 pb-4 pt-3 ${
        light ? 'border-ivory bg-ivory text-velvet-0' : 'border-velvet-3 bg-velvet-2 text-ivory'
      } ${className ?? ''}`}
    >
      <CoinIcon size={34} className="shrink-0 drop-shadow-[0_3px_6px_rgba(0,0,0,.4)]" />
      <div className="min-w-0 flex-1">
        <small className={`block text-[14px] leading-tight ${light ? 'text-ink-soft' : 'text-ivory-mute'}`}>{label}</small>
        <span className="flex items-baseline gap-1.5">
          <NumberRoller value={remaining} className="font-display text-[34px] font-black leading-[1.05]" />
          <span className={`text-[15px] font-semibold ${light ? 'text-ink-soft' : 'text-ivory-dim'}`}>{unitLabel}</span>
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-end">
        {name && (
          <span className="inline-flex items-center gap-2 text-[17px] font-semibold">
            <ParticipantMark name={name} size={30} tone={light ? 'paper' : 'active'} />
            <span className="max-w-[9rem] truncate">{name}</span>
          </span>
        )}
        <small className={`text-[14px] ${light ? 'text-ink-soft' : 'text-ivory-mute'}`}>
          מתוך <span className="num">{fmt(total)}</span>
        </small>
      </div>
      <div
        aria-hidden="true"
        className={`absolute inset-x-4 bottom-[7px] h-1 overflow-hidden rounded-full ${light ? 'bg-[rgba(29,19,22,.14)]' : 'bg-velvet-3'}`}
      >
        <i
          className="block h-full rounded-full bg-[linear-gradient(90deg,#8a5c3b,#cf9a62)] transition-[width] duration-500 ease-[var(--ease-out-expo)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
