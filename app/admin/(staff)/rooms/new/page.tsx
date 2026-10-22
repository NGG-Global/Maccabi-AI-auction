import RoomForm from '@/components/admin/RoomForm'

export default function NewRoomPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-black text-white">חדר חדש</h1>
      <RoomForm room={null} traits={[]} locked={false} isLive={false} participantCount={0} roundCount={0} />
    </div>
  )
}
