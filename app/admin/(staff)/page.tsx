import { connection } from 'next/server'
import RoomsList from '@/components/admin/RoomsList'
import { listRooms } from '@/lib/rooms/service'

export default async function AdminRoomsPage() {
  await connection()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <p className="text-slate-500">הגדירו את משתני הסביבה של Supabase.</p>
  }
  const rooms = await listRooms()
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black text-white">חדרי מכירה פומבית</h1>
        <p className="text-slate-500 text-sm">כל צוות NGG רואה את כל החדרים. כל חדר מופעל כאירוע נפרד עם מסך מוקרן משלו.</p>
      </div>
      <RoomsList rooms={rooms} />
    </div>
  )
}
