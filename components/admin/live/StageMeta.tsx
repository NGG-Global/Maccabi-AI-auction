import RoomBrand from '@/components/shared/RoomBrand'
import type { Room } from '@/lib/types'

interface Props {
  room: Room
  live?: boolean
  /** Text at the start of the right-hand group, e.g. "38 משתתפים". */
  note?: React.ReactNode
  /** Extra controls at the end (projected, keep them quiet). */
  end?: React.ReactNode
}

/** The 56px meta row at the top of every projected scene. */
export default function StageMeta({ room, live = false, note, end }: Props) {
  return (
    <div className="flex h-14 items-center justify-between gap-8 text-[26px] text-ink-2">
      <div className="flex min-w-0 items-center gap-[22px]">
        {live && <span aria-hidden="true" className="gm-live-dot shrink-0" />}
        <strong className="truncate text-[30px] font-bold text-ink">{room.title}</strong>
        {room.client_name && (
          <>
            <span aria-hidden="true" className="h-7 w-[2px] shrink-0 bg-ink-3" />
            <span className="truncate">{room.client_name}</span>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-[22px]">
        {note && <span>{note}</span>}
        {end}
        <RoomBrand title={room.title} clientName={room.client_name} logoPath={room.logo_path} logoOnly />
      </div>
    </div>
  )
}
