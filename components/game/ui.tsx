import Link from 'next/link'

/* Shared button, field and card styles for the "game box" surfaces (phone + staff). */

export const BTN = {
  base: 'press-sm inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] border-[2.5px] border-ink font-semibold text-ink transition-[background,border-color,color] duration-200 disabled:cursor-default disabled:border-muted-outline disabled:bg-disabled disabled:text-ink-3 disabled:shadow-none',
  primary: 'bg-tomato shadow-piece hover:bg-tomato-hover',
  secondary: 'bg-card shadow-piece-sm hover:bg-sun-tint',
  danger: 'border-error bg-card text-error shadow-piece-sm hover:bg-error-tint',
  md: 'h-[46px] px-5 text-[16px]',
  sm: 'h-[38px] px-[14px] text-[14px] rounded-[10px]',
}

type Variant = 'primary' | 'secondary' | 'danger'
type Size = 'md' | 'sm'

export function btnClass(variant: Variant = 'secondary', size: Size = 'md', extra = ''): string {
  return `${BTN.base} ${BTN[variant]} ${BTN[size]} ${extra}`
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={btnClass(variant, size, className)} {...rest} />
}

interface LinkButtonProps extends React.ComponentProps<typeof Link> {
  variant?: Variant
  size?: Size
}

export function LinkButton({ variant = 'secondary', size = 'md', className = '', ...rest }: LinkButtonProps) {
  return <Link className={btnClass(variant, size, className)} {...rest} />
}

/** The 64px phone primary button (tomato, ink text, hard shadow, pressed state). */
export const CTA =
  'piece-press flex h-16 w-full items-center justify-center gap-2 rounded-[22px] border-[3px] border-ink bg-tomato px-4 text-[23px] font-bold leading-none text-ink shadow-piece-md hover:bg-tomato-hover'

/** Staff and phone text fields. */
export const FIELD =
  'h-[46px] w-full rounded-[12px] border-2 border-ink bg-card px-[14px] text-[16px] text-ink transition-[box-shadow] duration-200 placeholder:text-ink-3 focus:shadow-[0_0_0_4px_var(--color-sun)] focus:outline-none disabled:border-muted-outline disabled:bg-disabled disabled:text-ink-3'
export const FIELD_BAD = 'border-error bg-error-tint'

export function Hint({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[13px] leading-[1.45] text-ink-3 ${className}`}>{children}</span>
}

export function ErrorText({ children, id, className = '' }: { children: React.ReactNode; id?: string; className?: string }) {
  return (
    <span id={id} role="alert" className={`flex items-center gap-1.5 text-[13px] font-semibold text-error ${className}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-error" />
      {children}
    </span>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`flex flex-col gap-4 rounded-[24px] border-[2.5px] border-ink bg-card px-6 py-[22px] shadow-piece-md ${className}`}>{children}</section>
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 text-[26px] font-bold text-ink">{children}</h2>
}

/** A notice in the same language for loading, error and empty states. */
export function Notice({ tone = 'neutral', children, className = '' }: { tone?: 'neutral' | 'error' | 'success'; children: React.ReactNode; className?: string }) {
  const cls =
    tone === 'error' ? 'border-error bg-error-tint text-error'
    : tone === 'success' ? 'border-ink bg-leaf text-ink'
    : 'border-ink bg-card text-ink-2'
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-[12px] border-2 px-4 py-3 text-[15px] leading-relaxed ${cls} ${className}`}>{children}</div>
}

/** Ink toast at the bottom of the screen (staff + projector). */
export function Toast({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'error' }) {
  return (
    <div
      role="status"
      className={`gm-toast fixed bottom-[calc(24px+env(safe-area-inset-bottom,0px))] left-1/2 z-50 -translate-x-1/2 rounded-[14px] border-[2.5px] px-[22px] py-[14px] text-[15px] font-bold shadow-piece ${
        tone === 'error' ? 'border-error bg-error-tint text-error' : 'border-ink bg-ink text-white'
      }`}
    >
      {children}
    </div>
  )
}
