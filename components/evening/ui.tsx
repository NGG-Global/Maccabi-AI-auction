import Link from 'next/link'

/* Shared button, field and card styles for the "Operate" surfaces (phone + staff). */

export const BTN = {
  base: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] border border-transparent font-bold transition-[background,border-color,color,transform] duration-200 active:scale-[.98] disabled:cursor-default disabled:opacity-45 disabled:active:scale-100',
  primary: 'bg-vermilion text-velvet-0 hover:bg-vermilion-hover',
  secondary: 'border-velvet-4 bg-velvet-2 text-ivory hover:border-ivory-mute',
  danger: 'border-[rgba(255,157,130,.4)] bg-transparent text-error hover:bg-[rgba(255,157,130,.08)]',
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

/** The 66px phone primary button (serif 900, 27px). */
export const CTA =
  'flex h-[66px] w-full items-center justify-center gap-2 rounded-[18px] bg-vermilion px-4 font-display text-[27px] font-black leading-none text-velvet-0 shadow-[var(--shadow-primary)] transition-[background,transform] duration-200 hover:bg-vermilion-hover active:scale-[.985] disabled:bg-velvet-3 disabled:text-ivory-mute disabled:shadow-none disabled:active:scale-100'

/** Staff and phone text fields. */
export const FIELD =
  'h-[46px] w-full rounded-[12px] border border-velvet-4 bg-velvet-1 px-[14px] text-[16px] text-ivory transition-[border-color,box-shadow] duration-200 placeholder:text-ivory-mute focus:border-vermilion focus:shadow-[0_0_0_3px_rgba(255,90,54,.22)] focus:outline-none disabled:opacity-55'
export const FIELD_BAD = 'border-[#ff8a6b]'

export function Hint({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[13px] leading-[1.45] text-ivory-mute ${className}`}>{children}</span>
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
  return <section className={`flex flex-col gap-4 rounded-[20px] border border-velvet-3 bg-velvet-2 px-6 py-[22px] ${className}`}>{children}</section>
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 font-display text-[26px] font-bold text-ivory">{children}</h2>
}

/** A notice in the same language for loading, error and empty states. */
export function Notice({ tone = 'neutral', children, className = '' }: { tone?: 'neutral' | 'error' | 'success'; children: React.ReactNode; className?: string }) {
  const cls =
    tone === 'error' ? 'border-[rgba(255,157,130,.4)] bg-[rgba(255,157,130,.08)] text-error'
    : tone === 'success' ? 'border-[rgba(255,90,54,.4)] bg-[rgba(255,90,54,.1)] text-[#ffd2c4]'
    : 'border-velvet-3 bg-velvet-2 text-ivory-dim'
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-[12px] border px-4 py-3 text-[15px] leading-relaxed ${cls} ${className}`}>{children}</div>
}

/** Ivory toast at the bottom of the screen (staff + projector). */
export function Toast({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'error' }) {
  return (
    <div
      role="status"
      className={`ev-toast fixed bottom-[calc(24px+env(safe-area-inset-bottom,0px))] left-1/2 z-50 -translate-x-1/2 rounded-[14px] px-[22px] py-[14px] text-[15px] font-bold shadow-[var(--shadow-menu)] ${
        tone === 'error' ? 'bg-[#2a1a1d] text-error border border-[rgba(255,157,130,.4)]' : 'bg-ivory text-velvet-0'
      }`}
    >
      {children}
    </div>
  )
}
