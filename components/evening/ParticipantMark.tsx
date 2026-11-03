import { initial } from './units'

type Tone = 'default' | 'active' | 'leader' | 'paper' | 'muted'

interface Props {
  name: string | null | undefined
  /** Side in px: 30 (phone), 52 (bid ladder), 96 (wall), 118 (leader on the projector). */
  size?: number
  tone?: Tone
  /** A short wooden handle under the mark (projector leader and wall only). */
  handle?: boolean
  /** Vermilion ring: "this is you" on the phone's preview of the wall. */
  ring?: boolean
  className?: string
}

const TONE: Record<Tone, string> = {
  default: 'bg-velvet-2 text-ivory-mute border-velvet-4',
  active: 'bg-ivory text-velvet-0 border-ivory',
  leader: 'bg-vermilion text-velvet-0 border-vermilion',
  paper: 'bg-velvet-2 text-ivory border-velvet-2',
  muted: 'bg-velvet-3 text-ivory border-velvet-3',
}

/**
 * A rounded square with the first letter of the participant's name. It
 * replaces participant numbers everywhere; the name is always shown as
 * text next to it, so the mark itself is decorative.
 */
export default function ParticipantMark({ name, size = 30, tone = 'active', handle = false, ring = false, className }: Props) {
  const fontSize = Math.round(size * (size >= 96 ? 0.5 : 0.6))
  const radius = Math.round(size * 0.2)
  const box = (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize, borderRadius: radius, borderWidth: size >= 52 ? 2 : 1.5 }}
      className={`inline-flex shrink-0 items-center justify-center border font-display font-black leading-none transition-[background,color,border-color,box-shadow] duration-500 ${TONE[tone]} ${
        ring ? 'shadow-[0_0_0_4px_var(--color-vermilion),0_16px_30px_rgba(0,0,0,.4)]' : size >= 96 && tone !== 'default' ? 'shadow-[0_14px_30px_rgba(0,0,0,.45)]' : ''
      } ${className ?? ''}`}
    >
      {initial(name)}
    </span>
  )
  if (!handle) return box
  const stickW = Math.max(8, Math.round(size * 0.16))
  const stickH = Math.max(16, Math.round(size * (size >= 150 ? 0.72 : 0.42)))
  return (
    <span className="inline-flex flex-col items-center" aria-hidden="true">
      {box}
      <span
        style={{ width: stickW, height: stickH }}
        className={`rounded-b-[6px] transition-[background] duration-500 ${tone === 'default' ? 'bg-velvet-3' : 'bg-[linear-gradient(90deg,#7a5a45,#a37b5e_50%,#6b4c39)]'}`}
      />
    </span>
  )
}
