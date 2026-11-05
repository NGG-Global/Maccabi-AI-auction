import { connection } from 'next/server'
import RoomsList from '@/components/admin/RoomsList'
import { listRooms } from '@/lib/rooms/service'
import { Notice } from '@/components/game/ui'

export default async function AdminRoomsPage() {
  await connection()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <Notice tone="error">הגדירו את משתני הסביבה של Supabase.</Notice>
  }
  const rooms = await listRooms()
  return <RoomsList rooms={rooms} />
}
