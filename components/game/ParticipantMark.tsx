import { initial } from './units'

export type MarkTone = 'ink' | 'sky' | 'leaf' | 'lilac' | 'peach' | 'sun' | 'pending'

interface Props {
  name: string | null | undefined
  /** Diameter in px: 30 (phone), 56 (bid ladder), 96 (wall), 108 (leader on the projector). */
  size?: number
  tone?: MarkTone
  /** A hard shadow (wall tokens, the leader). */
  shadow?: boolean
  /** Tomato ring: "this is you" on the phone's preview of the wall. */
  ring?: boolean
  className?: string
}

const TONE: Record<MarkTone, string> = {
  ink: 'bg-ink text-white border-ink',
  sky: 'bg-sky text-ink border-ink',
  leaf: 'bg-leaf text-ink border-ink',
  lilac: 'bg-lilac text-ink border-ink',
  peach: 'bg-peach text-ink border-ink',
  sun: 'bg-sun text-ink border-ink',
  pending: 'border-dashed border-[#93a5b3] bg-white/55 text-[#7a8896]',
}

/** The player colours, cycled across a wall. */
export const PLAYER_TONES: MarkTone[] = ['sky', 'lilac', 'peach']

/**
 * A round token with the first letter of the participant's name. It
 * replaces participant numbers everywhere; the name is always shown as
 * text next to it, so the token itself is decorative.
 */
export default function ParticipantMark({ name, size = 30, tone = 'ink', shadow = false, ring = false, className }: Props) {
  const fontSize = Math.round(size * (size >= 96 ? 0.48 : 0.5))
  const border = size >= 96 ? 4 : size >= 52 ? 3 : 2
  const shadowPx = size >= 96 ? 6 : 4
  const boxShadow = [
    ring ? '0 0 0 6px var(--color-tomato)' : null,
    shadow ? `${shadowPx}px ${shadowPx}px 0 var(--color-ink)` : null,
  ].filter(Boolean).join(', ') || undefined
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize, borderWidth: border, boxShadow }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-bold leading-none transition-[background,color,border-color,box-shadow] duration-500 ${TONE[tone]} ${className ?? ''}`}
    >
      {initial(name)}
    </span>
  )
}
