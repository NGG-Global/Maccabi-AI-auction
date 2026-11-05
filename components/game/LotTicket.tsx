import { lotNo } from './units'

interface Props {
  index1: number
  total?: number
  category?: string | null
  title: string
  description?: string | null
  /** phone: the small card; projector: the big tilted card. */
  variant?: 'phone' | 'projector'
  className?: string
}

/**
 * The statement card: a white card with an ink outline, a hard shadow and
 * a slight tilt. Two tabs overlap its top edge: the lot number (tomato)
 * and the category (sky).
 */
export default function LotTicket({ index1, total, category, title, description, variant = 'phone', className }: Props) {
  if (variant === 'projector') {
    return (
      <div className={`relative mt-[26px] rotate-[-0.8deg] rounded-[32px] border-4 border-ink bg-card px-[52px] pb-[42px] pt-12 shadow-piece-2xl ${className ?? ''}`}>
        <div className="absolute -top-[30px] right-10 flex items-center gap-3">
          <span className="inline-flex h-14 items-center rounded-[18px] border-4 border-ink bg-tomato px-5 text-[26px] font-bold text-ink">
            פריט <span className="num mx-1">{index1}</span>{total ? <>מתוך <span className="num mx-1">{total}</span></> : null}
          </span>
          {category && (
            <span className="inline-flex h-14 items-center rounded-[18px] border-4 border-ink bg-sky px-5 text-[24px] font-bold text-ink">{category}</span>
          )}
        </div>
        <h1 className="m-0 text-[96px] font-semibold leading-[1.06] tracking-[-.01em] text-ink [text-wrap:balance]">{title}</h1>
      </div>
    )
  }
  return (
    <div className={`relative mt-3 rotate-[-0.6deg] rounded-[24px] border-[3px] border-ink bg-card px-[22px] pb-5 pt-6 shadow-piece-md ${className ?? ''}`}>
      <div className="absolute -top-[18px] right-5 flex items-center gap-2">
        <span className="inline-flex h-9 items-center rounded-[12px] border-[3px] border-ink bg-tomato px-[10px] text-[17px] font-bold text-ink">
          פריט <span className="num mr-1">{lotNo(index1)}</span>
        </span>
      </div>
      <div className="flex items-start justify-between gap-3">
        <p className="m-0 min-w-0 flex-1 text-[28px] font-semibold leading-[1.15] text-ink">{title}</p>
        {category && <span className="mt-1 shrink-0 text-[16px] text-ink-3">{category}</span>}
      </div>
      {description && <p className="m-0 mt-2 text-[15px] leading-relaxed text-ink-2">{description}</p>}
    </div>
  )
}
