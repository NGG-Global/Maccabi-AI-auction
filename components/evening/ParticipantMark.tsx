import { initial } from './units'

type Size = 30 | 52 | 96 | 118 | 150
type Tone = 'default' | 'active' | 'leader' | 'paper'

interface Props {
  name: string | null | undefined
  size?: Size
  tone?: Tone
  /** A short wooden handle under the mark (projector leader and wall only). */
  handle?: boolean
  /** Vermilion ring: "this is you" on the phone's preview of the wall. */
  ring?: boolean
  className?: string
}

const FONT: Record<Size, string> = { 30: 'text-[18px] rounded-[9px]', 52: 'text-[32px] rounded-[10px]', 96: 'text-[46px] rounded-[18px]', 118: 'text-[64px] rounded-[24px]', 150: 'text-[84px] rounded-[30px]' }
const TONE: Record<Tone, string> = {
  default: 'bg-velvet-2 text-ivory-mute border-2 border-velvet-4',
  active: 'bg-ivory text-velvet-0 border-2 border-ivory',
  leader: 'bg-vermilion text-velvet-0 border-2 border-vermilion',
  paper: 'bg-velvet-2 text-ivory border-2 border-velvet-2',
}

/**
 * A rounded square with the first letter of the participant's name. It
 * replaces participant numbers everywhere; the name is always shown as
 * text next to it, so the mark itself is decorative.
 */
export default function ParticipantMark({ name, size = 30, tone = 'active', handle = false, ring = false, className }: Props) {
  const box = (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center font-display font-black leading-none transition-[background,color,border-color,box-shadow] duration-500 ${FONT[size]} ${TONE[tone]} ${
        ring ? 'shadow-[0_0_0_4px_var(--color-vermilion),0_16px_30px_rgba(0,0,0,.4)]' : size >= 96 && tone !== 'default' ? 'shadow-[0_14px_30px_rgba(0,0,0,.45)]' : ''
      } ${className ?? ''}`}
    >
      {initial(name)}
    </span>
  )
  if (!handle) return box
  const stickW = size >= 150 ? 24 : size >= 118 ? 20 : 14
  const stickH = size >= 150 ? 110 : size >= 118 ? 54 : 38
  return (
    <span className="inline-flex flex-col items-center" aria-hidden="true">
      {box}
      <span
        style={{ width: stickW, height: stickH }}
        className={`rounded-b-[6px] ${tone === 'default' ? 'bg-velvet-3' : 'bg-[linear-gradient(90deg,#7a5a45,#a37b5e_50%,#6b4c39)]'}`}
      />
    </span>
  )
}
