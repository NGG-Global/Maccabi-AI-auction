import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { AuctionRound, Room, RoomListItem, Trait } from '@/lib/types'
import { ROUND_WINNERS_SELECT } from '@/lib/game/allocation'

/** Server-side room reads (service role). Writes go through the RPCs. */

export function isRoomLive(room: Pick<Room, 'status' | 'active_until'>, now: number = Date.now()): boolean {
  return room.status === 'active' && !!room.active_until && new Date(room.active_until).getTime() > now
}

export interface RoomDetail {
  room: Room
  traits: Trait[]
  participant_count: number
  round_count: number
  locked: boolean
  is_live: boolean
}

export async function listRooms(): Promise<RoomListItem[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('room_overview')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`listRooms: ${error.message}`)
  return (data ?? []).map(row => {
    const r = row as Room & { participant_count: number; round_count: number; trait_count: number }
    return {
      ...r,
      is_live: isRoomLive(r),
      locked: r.participant_count > 0 || r.round_count > 0,
    }
  })
}

export async function getRoomDetail(id: string): Promise<RoomDetail | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('room_overview').select('*').eq('id', id).maybeSingle()
  if (!data) return null
  const r = data as Room & { participant_count: number; round_count: number; trait_count: number }
  const { data: traits } = await supabase
    .from('traits')
    .select('*')
    .eq('room_id', id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return {
    room: r,
    traits: (traits ?? []) as Trait[],
    participant_count: r.participant_count,
    round_count: r.round_count,
    locked: r.participant_count > 0 || r.round_count > 0,
    is_live: isRoomLive(r),
  }
}

export async function getRoomBySlug(slug: string): Promise<Room | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('rooms').select('*').eq('slug', slug).maybeSingle()
  return (data as Room | null) ?? null
}

/** The latest open or closed round of a room, with trait, winner and (allocation) winners joined. */
export async function getLatestRound(roomId: string): Promise<AuctionRound | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('auction_rounds')
    .select(`*, trait:traits!auction_rounds_trait_id_fkey(*), winner:participants!auction_rounds_winner_participant_id_fkey(*), ${ROUND_WINNERS_SELECT}`)
    .eq('room_id', roomId)
    .in('status', ['open', 'closed'])
    .order('created_at', { ascending: false })
    .limit(1)
  return ((data?.[0] ?? null) as AuctionRound | null)
}
