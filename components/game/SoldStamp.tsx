interface Props {
  /** The sticker line ("נמכר", "נמכר לך", "לא נמכרה"). */
  text: string
  /** The smaller line under it ("לנועה"). */
  sub?: string
  size?: 'projector' | 'phone' | 'queue'
  /** Play the slam animation (projector strike). Otherwise the sticker is simply shown. */
  animate?: boolean
  /** A muted sticker (no winner). */
  muted?: boolean
  className?: string
}

/** The tomato sticker with an ink outline and a hard shadow. Decorative: the same words are read out elsewhere. */
export default function SoldStamp({ text, sub, size = 'projector', animate = false, muted = false, className }: Props) {
  const fill = muted ? 'bg-[#eef3f0] text-ink-3' : 'bg-tomato text-ink'
  if (size === 'queue') {
    return (
      <span className={`inline-block rotate-[-6deg] rounded-[12px] border-[3px] border-ink px-[10px] text-[17px] font-bold leading-[1.6] ${fill} ${className ?? ''}`}>
        {text}
      </span>
    )
  }
  if (size === 'phone') {
    return (
      <span className={`inline-block rotate-[-7deg] rounded-[18px] border-4 border-ink px-6 pb-2 pt-1 text-[54px] font-bold leading-none shadow-piece-md ${fill} ${animate ? 'gm-slam' : ''} ${className ?? ''}`}>
        {text}
      </span>
    )
  }
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none rounded-[30px] border-[6px] border-ink px-11 pb-[18px] pt-1 text-center text-[120px] font-bold leading-none shadow-piece-xl ${fill} ${
        animate ? 'gm-slam' : 'rotate-[-9deg]'
      } ${className ?? ''}`}
    >
      {text}
      {sub && <small className="-mt-1 block text-[40px] font-semibold">{sub}</small>}
    </div>
  )
}
