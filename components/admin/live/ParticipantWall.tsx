import ParticipantMark from '@/components/evening/ParticipantMark'

export interface WallPerson { id: string; name: string; up: boolean }

interface Props {
  people: WallPerson[]
  /** Highlight one person with a vermilion ring (phone preview only). */
  meId?: string | null
}

/** Mark size and columns by head count, so 12 or 100 people fit the 220px band. */
function layout(n: number): { cols: number; size: number; names: boolean; handle: boolean } {
  if (n <= 12) return { cols: 12, size: 96, names: true, handle: true }
  if (n <= 32) return { cols: 16, size: 60, names: true, handle: true }
  if (n <= 60) return { cols: 20, size: 48, names: true, handle: false }
  if (n <= 96) return { cols: 24, size: 40, names: false, handle: false }
  return { cols: 30, size: 32, names: false, handle: false }
}

/**
 * One mark per registered participant. Not submitted: lowered and muted.
 * Submitted: risen and ivory. Amounts are never shown here.
 */
export default function ParticipantWall({ people, meId = null }: Props) {
  const l = layout(people.length)
  if (people.length === 0) {
    return <p className="m-0 flex h-[220px] items-end text-[26px] text-ivory-mute">עדיין לא נכנס אף אחד. הקוד משמאל פתוח.</p>
  }
  return (
    <ul
      className="m-0 grid list-none items-end gap-x-3 gap-y-2 p-0"
      style={{ gridTemplateColumns: `repeat(${l.cols}, minmax(0, 1fr))`, minHeight: 220 }}
      aria-label="משתתפים"
    >
      {people.map(p => (
        <li
          key={p.id}
          title={p.name}
          className={`flex flex-col items-center transition-transform duration-700 ease-[var(--ease-out-expo)] ${p.up ? 'translate-y-0' : 'translate-y-[46px]'}`}
          style={l.names ? undefined : { transform: p.up ? 'none' : 'translateY(12px)' }}
        >
          <ParticipantMark name={p.name} size={l.size} tone={p.up ? 'active' : 'default'} handle={l.handle} ring={meId === p.id} />
          {l.names && (
            <span
              className={`mt-[10px] max-w-full truncate font-semibold transition-colors duration-500 ${p.up ? 'text-ivory' : 'text-ivory-mute'}`}
              style={{ fontSize: Math.max(14, Math.round(l.size * 0.23)) }}
            >
              {p.name}
            </span>
          )}
          <span className="sr-only">{p.up ? 'שלח' : 'טרם שלח'}</span>
        </li>
      ))}
    </ul>
  )
}
