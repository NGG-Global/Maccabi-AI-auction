import Link from 'next/link'
import RoomForm from '@/components/admin/RoomForm'
import StatusPill from '@/components/evening/StatusPill'

export default function NewRoomPage() {
  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 self-start text-[15px] font-semibold text-ivory-dim hover:text-ivory">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        חזרה לסשנים
      </Link>
      <div className="flex flex-wrap items-center gap-[14px]">
        <h1 className="m-0 font-display text-[46px] font-black leading-[1.05] tracking-[-.01em] text-ivory">סשן חדש</h1>
        <StatusPill kind="draft">טיוטה</StatusPill>
      </div>
      <RoomForm room={null} traits={[]} locked={false} isLive={false} participantCount={0} roundCount={0} />
    </div>
  )
}
