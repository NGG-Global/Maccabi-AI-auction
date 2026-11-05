import SoldStamp from '@/components/game/SoldStamp'
import { fmt, lotNo } from '@/components/game/units'

export interface QueueLot {
  id: string
  title: string
  state: 'sold' | 'unsold' | 'live' | 'waiting'
  price?: number | null
}

interface Props {
  lots: QueueLot[]
  /** The close / next button (or confirm) at the end of the row. */
  action: React.ReactNode
}

/** Small white outlined cards for all statements with their state, and the action at the end. */
export default function LotQueue({ lots, action }: Props) {
  return (
    <div className="flex items-end gap-[14px]" style={{ gridColumn: '1 / -1' }}>
      <ol className="m-0 flex min-w-0 flex-1 list-none items-end gap-[14px] p-0" aria-label="פריטי המכירה">
        {lots.map((lot, i) => {
          const live = lot.state === 'live'
          return (
            <li
              key={lot.id}
              className={`relative flex h-[104px] min-w-0 flex-1 flex-col justify-between rounded-[22px] border-[3px] border-ink px-[18px] py-3 ${
                live ? '-translate-y-3 bg-sun shadow-piece-lg' : 'bg-card'
              }`}
            >
              <span className="num self-start text-[24px] text-ink">{lotNo(i + 1)}</span>
              <span className={`truncate text-[19px] ${live ? 'font-semibold text-ink' : 'font-medium text-ink-3'}`}>{lot.title}</span>
              {lot.state === 'sold' && (
                <span className="absolute -top-[18px] left-2.5">
                  <SoldStamp size="queue" text={`נמכר · ${fmt(lot.price ?? 0)}`} />
                </span>
              )}
              {lot.state === 'unsold' && (
                <span className="absolute -top-[18px] left-2.5">
                  <SoldStamp size="queue" text="לא נמכרה" muted />
                </span>
              )}
              <span className="sr-only">{live ? 'עכשיו על הבמה' : lot.state === 'waiting' ? 'ממתין' : ''}</span>
            </li>
          )
        })}
      </ol>
      {action}
    </div>
  )
}
