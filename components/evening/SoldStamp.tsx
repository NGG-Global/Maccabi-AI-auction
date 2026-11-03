interface Props {
  /** The stamp line ("נמכר", "נמכר לך", "לא נמכרה"). */
  text: string
  /** The smaller line under it ("לנועה"). */
  sub?: string
  size?: 'projector' | 'phone' | 'queue'
  /** Play the slam animation (projector strike). Otherwise the stamp is simply shown. */
  animate?: boolean
  className?: string
}

/** The vermilion rough-ink stamp. Decorative: the same words are read out elsewhere. */
export default function SoldStamp({ text, sub, size = 'projector', animate = false, className }: Props) {
  if (size === 'queue') {
    return (
      <span className={`inline-block rotate-[-6deg] rounded-[5px] border-[2.5px] border-vermilion px-2 font-display text-[18px] font-black leading-[1.35] text-vermilion ${className ?? ''}`}>
        {text}
      </span>
    )
  }
  if (size === 'phone') {
    return (
      <span className={`stamp-ink inline-block rotate-[-7deg] rounded-[14px] border-[6px] border-vermilion px-6 pb-[10px] pt-[2px] font-display text-[54px] font-black leading-none text-vermilion ${animate ? 'ev-slam' : ''} ${className ?? ''}`}>
        {text}
      </span>
    )
  }
  return (
    <div
      aria-hidden="true"
      className={`stamp-ink pointer-events-none rounded-[22px] border-[12px] border-vermilion px-11 pb-5 pt-[6px] text-center font-display text-[150px] font-black leading-none text-vermilion ${
        animate ? 'ev-slam' : 'rotate-[-9deg]'
      } ${className ?? ''}`}
    >
      {text}
      {sub && <small className="-mt-[6px] block text-[40px] tracking-[.02em]">{sub}</small>}
    </div>
  )
}
