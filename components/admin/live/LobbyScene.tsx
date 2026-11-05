import NumberRoller from '@/components/game/NumberRoller'
import { JoinQrCard } from '@/components/admin/JoinShare'
import ParticipantWall, { type WallPerson } from './ParticipantWall'

interface Props {
  headline: string
  sub: React.ReactNode
  /** The big tomato number and the words after it ("מתוך 12 שלחו"). */
  count: number
  countLabel: React.ReactNode
  people: WallPerson[]
  slug: string
  /** The footer note on the start side. */
  note: React.ReactNode
  /** The footer action on the end side. */
  action: React.ReactNode
}

/**
 * The lobby layout: headline, subline, the big count, the participant
 * wall, the QR card and a footer row. Used while an allocation is open
 * and while the room waits for the first lot.
 */
export default function LobbyScene({ headline, sub, count, countLabel, people, slug, note, action }: Props) {
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_520px] grid-rows-[minmax(0,1fr)_120px] gap-x-20 gap-y-6">
      <div className="flex min-w-0 flex-col justify-center gap-[34px]">
        <h1 className="m-0 text-[150px] font-bold leading-[.95] tracking-[-.015em] text-ink">{headline}</h1>
        <p className="m-0 max-w-[44ch] text-[38px] leading-[1.35] text-ink-2 [text-wrap:balance]">{sub}</p>
        <div className="flex items-end gap-6">
          <span className="text-[190px] font-bold leading-[.86] text-tomato">
            <NumberRoller value={count} />
          </span>
          <span className="pb-[14px] text-[48px] font-semibold text-ink">{countLabel}</span>
        </div>
        <ParticipantWall people={people} />
      </div>
      <div className="self-center">
        <JoinQrCard slug={slug} />
      </div>
      <div className="col-span-2 flex items-center justify-between gap-6 text-[26px] text-ink-2">
        <span>{note}</span>
        {action}
      </div>
    </div>
  )
}
