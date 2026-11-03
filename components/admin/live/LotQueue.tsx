import SoldStamp from '@/components/evening/SoldStamp'
import { fmt, lotNo } from '@/components/evening/units'

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

/** Horizontal chips for all statements with their state, and the action at the end. */
export default function LotQueue({ lots, action }: Props) {
  return (
    <div className="flex items-center gap-[14px]" style={{ gridColumn: '1 / -1' }}>
      <ol className="m-0 flex min-w-0 flex-1 list-none items-stretch gap-[14px] p-0" aria-label="פריטי המכירה">
        {lots.map((lot, i) => {
          const live = lot.state === 'live'
          return (
            <li
              key={lot.id}
              className={`relative flex h-24 min-w-0 flex-1 flex-col justify-between overflow-hidden rounded-[12px] border px-[18px] py-3 ${
                live ? 'border-ivory bg-ivory' : 'border-velvet-3 bg-velvet-2'
              }`}
            >
              <span className={`num text-[24px] ${live ? 'text-velvet-0' : 'text-ivory-mute'}`}>{lotNo(i + 1)}</span>
              <span className={`truncate text-[19px] font-semibold ${live ? 'text-velvet-0' : 'text-ivory-dim'}`}>{lot.title}</span>
              {lot.state === 'sold' && (
                <span className="absolute left-3 top-2.5">
                  <SoldStamp size="queue" text={`נמכר · ${fmt(lot.price ?? 0)}`} />
                </span>
              )}
              {lot.state === 'unsold' && (
                <span className="absolute left-3 top-2.5">
                  <SoldStamp size="queue" text="לא נמכרה" className="!border-ivory-mute !text-ivory-mute" />
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
