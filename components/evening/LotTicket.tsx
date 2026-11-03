import { lotNo } from './units'

interface Props {
  index1: number
  total?: number
  category?: string | null
  title: string
  description?: string | null
  /** phone: a velvet card; projector: the main block typography. */
  variant?: 'phone' | 'projector'
  className?: string
}

/** The statement card: lot line ("פריט 03", "מתוך 07", category pill), then the statement. */
export default function LotTicket({ index1, total, category, title, description, variant = 'phone', className }: Props) {
  if (variant === 'projector') {
    return (
      <div className={`flex min-w-0 flex-col gap-10 ${className ?? ''}`}>
        <div className="flex items-center gap-[22px] text-[26px] text-ivory-dim">
          <span className="font-display text-[30px] font-black tracking-[.04em] text-ivory">פריט {lotNo(index1)}</span>
          {total ? <span>מתוך {lotNo(total)}</span> : null}
          {category && <span className="rounded-full border-[1.5px] border-velvet-4 px-[18px] py-1 text-[22px] font-semibold text-ivory-dim">{category}</span>}
        </div>
        <h1 className="m-0 max-w-[1180px] font-display text-[118px] font-black leading-[1.02] tracking-[-.018em] text-ivory [text-wrap:balance]">
          {title}
        </h1>
      </div>
    )
  }
  return (
    <div className={`flex flex-col gap-3 rounded-[22px] border border-velvet-3 bg-velvet-2 px-[22px] py-5 ${className ?? ''}`}>
      <div className="flex items-center justify-between text-[16px] text-ivory-mute">
        <b className="font-display text-[22px] font-black text-ivory">פריט {lotNo(index1)}</b>
        {category && <span>{category}</span>}
      </div>
      <p className="m-0 font-display text-[31px] font-black leading-[1.12] text-ivory">{title}</p>
      {description && <p className="m-0 text-[15px] leading-relaxed text-ivory-dim">{description}</p>}
    </div>
  )
}
