import ParticipantMark, { PLAYER_TONES } from '@/components/game/ParticipantMark'

export interface WallPerson { id: string; name: string; up: boolean }

interface Props {
  people: WallPerson[]
  /** Highlight one person with a sunflower token and a tomato ring (phone preview only). */
  meId?: string | null
}

/** Token size and columns by head count, so 12 or 100 people fit the 220px band. */
function layout(n: number): { cols: number; size: number; names: boolean } {
  if (n <= 12) return { cols: 12, size: 96, names: true }
  if (n <= 32) return { cols: 16, size: 64, names: true }
  if (n <= 60) return { cols: 20, size: 50, names: true }
  if (n <= 96) return { cols: 24, size: 42, names: false }
  return { cols: 30, size: 34, names: false }
}

/**
 * One round token per registered participant. Not submitted: lowered, with
 * a dashed outline. Submitted: it pops up and gets a player colour.
 * Amounts are never shown here.
 */
export default function ParticipantWall({ people, meId = null }: Props) {
  const l = layout(people.length)
  if (people.length === 0) {
    return <p className="m-0 flex h-[220px] items-end text-[26px] text-ink-3">עדיין לא נכנס אף אחד. הקוד משמאל פתוח.</p>
  }
  return (
    <ul
      className="m-0 grid list-none items-end gap-x-3 gap-y-2 p-0"
      style={{ gridTemplateColumns: `repeat(${l.cols}, minmax(0, 1fr))`, minHeight: 220 }}
      aria-label="משתתפים"
    >
      {people.map((p, i) => {
        const me = meId === p.id
        return (
          <li
            key={p.id}
            title={p.name}
            className={`flex flex-col items-center transition-transform duration-700 ease-[var(--ease-out-expo)] ${p.up ? 'translate-y-0' : l.names ? 'translate-y-[34px]' : 'translate-y-[10px]'}`}
          >
            <ParticipantMark
              name={p.name}
              size={l.size}
              tone={!p.up ? 'pending' : me ? 'sun' : PLAYER_TONES[i % PLAYER_TONES.length]}
              shadow={p.up}
              ring={me}
            />
            {l.names && (
              <span
                className={`mt-[10px] max-w-full truncate transition-colors duration-500 ${p.up ? 'font-semibold text-ink' : 'text-ink-3'}`}
                style={{ fontSize: Math.max(14, Math.round(l.size * 0.23)) }}
              >
                {p.name}
              </span>
            )}
            <span className="sr-only">{p.up ? 'שלח' : 'טרם שלח'}</span>
          </li>
        )
      })}
    </ul>
  )
}
