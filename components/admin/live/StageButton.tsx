'use client'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  /** A check mark before the label (the close action). */
  check?: boolean
}

/** The 96px stage button ("סגירת הסבב", "פתיחת המכירה"). Vermilion is reserved for the primary one. */
export default function StageButton({ variant = 'primary', check = false, className = '', children, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`flex h-24 shrink-0 items-center gap-4 rounded-[14px] border-0 px-10 font-display text-[36px] font-black leading-none transition-[transform,background] duration-200 active:scale-[.98] disabled:cursor-default disabled:bg-velvet-3 disabled:text-ivory-mute disabled:shadow-none disabled:active:scale-100 ${
        variant === 'primary'
          ? 'bg-vermilion text-velvet-0 shadow-[var(--shadow-primary)] hover:bg-vermilion-hover'
          : 'border border-velvet-4 bg-velvet-2 text-ivory hover:border-ivory-mute'
      } ${className}`}
      {...rest}
    >
      {check && (
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-11 w-11">
          <path d="M14 24l7 7 14-15" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {children}
    </button>
  )
}

/** A two-step confirm in the same row: the question, then confirm / cancel. */
export function StageConfirm({ question, onConfirm, onCancel, busy = false }: { question: string; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return (
    <div className="ev-rise flex shrink-0 items-center gap-5">
      <span className="max-w-[560px] text-[28px] leading-[1.25] text-ivory-dim">{question}</span>
      <StageButton variant="secondary" onClick={onCancel} disabled={busy} className="h-20 px-7 text-[28px]">ביטול</StageButton>
      <StageButton check onClick={onConfirm} disabled={busy} className="h-20 px-8 text-[30px]">{busy ? 'סוגרים…' : 'אישור'}</StageButton>
    </div>
  )
}
