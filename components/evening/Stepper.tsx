'use client'

import CoinIcon from './CoinIcon'

interface Props {
  value: number
  onDown: () => void
  onUp: () => void
  downDisabled?: boolean
  upDisabled?: boolean
  downLabel: string
  upLabel: string
  /** 64px round buttons (auction) or 52px (allocation rows). */
  size?: 'lg' | 'sm'
  /** Optional caption under the value (auction: "ההצעה שלך"). */
  caption?: string
  /** An editable value: the number becomes a numeric input. */
  inputValue?: string
  onInput?: (raw: string) => void
  inputLabel?: string
  coin?: boolean
  className?: string
}

const BTN = {
  lg: 'h-16 w-16 rounded-[18px]',
  sm: 'h-[52px] w-[52px] rounded-[14px]',
}
const ICON = { lg: 'h-[26px] w-[26px]', sm: 'h-[22px] w-[22px]' }

function Minus({ className }: { className: string }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}><path d="M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
}
function Plus({ className }: { className: string }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}><path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
}

/** −, value, +. The row is LTR so the number reads naturally; the caption stays RTL. */
export default function Stepper({
  value, onDown, onUp, downDisabled, upDisabled, downLabel, upLabel, size = 'lg', caption,
  inputValue, onInput, inputLabel, coin = size === 'lg', className,
}: Props) {
  const btn = `${BTN[size]} inline-flex shrink-0 items-center justify-center border-[1.5px] border-velvet-4 bg-velvet-2 text-ivory transition-[background,transform] duration-150 active:scale-95 disabled:opacity-35 disabled:active:scale-100`
  const editable = typeof inputValue === 'string' && onInput
  return (
    <div dir="ltr" className={`flex items-center justify-between gap-2 ${className ?? ''}`}>
      <button type="button" onClick={onDown} disabled={downDisabled} aria-label={downLabel} className={btn}>
        <Minus className={ICON[size]} />
      </button>
      <div dir="rtl" className="flex min-w-0 flex-1 flex-col items-center">
        <span className="inline-flex items-center gap-2">
          {coin && <CoinIcon size={28} />}
          {editable ? (
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={inputValue}
              onChange={e => onInput(e.target.value.replace(/[^\d]/g, ''))}
              aria-label={inputLabel}
              className={`num w-[6ch] bg-transparent text-center outline-none focus-visible:outline-none focus-visible:underline focus-visible:decoration-vermilion focus-visible:decoration-4 ${size === 'lg' ? 'text-[44px]' : 'text-[24px]'} leading-none`}
            />
          ) : (
            <b className={`num ${size === 'lg' ? 'text-[44px]' : 'text-[24px]'} leading-none`}>{value.toLocaleString('en-US')}</b>
          )}
        </span>
        {caption && <small className="mt-1 text-[15px] text-ivory-mute">{caption}</small>}
      </div>
      <button type="button" onClick={onUp} disabled={upDisabled} aria-label={upLabel} className={btn}>
        <Plus className={ICON[size]} />
      </button>
    </div>
  )
}
