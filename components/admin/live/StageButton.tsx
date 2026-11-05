'use client'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  /** A check mark before the label (the close action). */
  check?: boolean
}

/** The 104px stage button ("סגירת הסבב", "פתיחת המכירה"): tomato, ink outline, hard shadow, pressed state. */
export default function StageButton({ variant = 'primary', check = false, className = '', children, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`piece-press flex h-[104px] shrink-0 items-center gap-4 rounded-[26px] border-4 border-ink px-10 text-[36px] font-bold leading-none text-ink shadow-piece-lg ${
        variant === 'primary' ? 'bg-tomato hover:bg-tomato-hover' : 'bg-card hover:bg-sun-tint'
      } ${className}`}
      {...rest}
    >
      {check && (
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-11 w-11">
          <path d="M14 24l7 7 14-15" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {children}
    </button>
  )
}

/** A two-step confirm in the same row: the question, then confirm / cancel. */
export function StageConfirm({ question, onConfirm, onCancel, busy = false }: { question: string; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return (
    <div className="gm-rise flex shrink-0 items-center gap-5">
      <span className="max-w-[560px] text-[28px] font-medium leading-[1.25] text-ink-2">{question}</span>
      <StageButton variant="secondary" onClick={onCancel} disabled={busy} className="h-20 px-7 text-[28px]">ביטול</StageButton>
      <StageButton check onClick={onConfirm} disabled={busy} className="h-20 px-8 text-[30px]">{busy ? 'סוגרים…' : 'אישור'}</StageButton>
    </div>
  )
}
