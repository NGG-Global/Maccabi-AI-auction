export type RoomStatus = 'draft' | 'active' | 'ended' | 'archived'
export type RoundStatus = 'draft' | 'open' | 'closed' | 'cancelled'
export type WalletReason = 'initial_grant' | 'round_bid_payment' | 'admin_adjustment' | 'reset'
// auction: one trait per round. allocation: all traits open at once and
// each participant splits their wallet across them (migration 008).
export type GameMode = 'auction' | 'allocation'

// The four fixed statement categories. The profile archetype and the
// analytics breakdown depend on exactly these labels (migration 010).
export const TRAIT_CATEGORIES = ['מנהיגות', 'יחסים', 'שיפוט', 'למידה'] as const
export type TraitCategory = (typeof TRAIT_CATEGORIES)[number]

/** A room: one auction event with its own settings, statements and participants. */
export interface Room {
  id: string
  slug: string
  title: string
  client_name: string
  logo_path: string | null
  status: RoomStatus
  game_mode: GameMode
  starting_coins: number
  default_round_seconds: number | null
  current_round_id: string | null
  created_at: string
  // Server-side only (not granted to the browser; see migration 010)
  created_by_email?: string | null
  updated_at?: string
  activated_at?: string | null
  active_until?: string | null
}

/** The room columns the browser (anon key) may read. */
export const ROOM_PUBLIC_COLUMNS =
  'id, slug, title, client_name, logo_path, game_mode, status, starting_coins, default_round_seconds, current_round_id, created_at'

export type PublicRoom = Pick<
  Room,
  | 'id' | 'slug' | 'title' | 'client_name' | 'logo_path' | 'game_mode' | 'status'
  | 'starting_coins' | 'default_round_seconds' | 'current_round_id' | 'created_at'
>

export interface Participant {
  id: string
  room_id: string
  display_name: string
  wallet_balance: number
  created_at: string
  last_seen_at: string | null
}

export interface Trait {
  id: string
  room_id: string
  title: string
  description: string
  category: TraitCategory
  sort_order: number | null
  is_used: boolean
  created_at: string
}

// Allocation mode: everyone on a trait's top amount shares the win (migration 009).
export interface RoundWinner {
  participant_id: string
  amount: number
  participant?: Pick<Participant, 'id' | 'display_name'>
}

export interface AuctionRound {
  id: string
  room_id: string
  trait_id: string
  status: RoundStatus
  mode?: GameMode
  opened_at: string | null
  closed_at: string | null
  winner_participant_id: string | null
  winning_bid_amount: number | null
  created_at: string
  // joined
  trait?: Trait
  winner?: Participant
  winners?: RoundWinner[]
}

export interface Bid {
  id: string
  room_id: string
  round_id: string
  participant_id: string
  amount: number
  created_at: string
  updated_at: string
  // joined
  participant?: Participant
}

export interface WalletTransaction {
  id: string
  room_id: string
  participant_id: string
  round_id: string | null
  amount_delta: number
  reason: WalletReason
  created_at: string
}

/** Statement as edited in the room form and sent to create_room / update_room. */
export interface TraitInput {
  id?: string
  title: string
  description?: string
  category: TraitCategory
  sort_order: number
}

/** Room settings as edited in the room form. */
export interface RoomInput {
  slug: string
  title: string
  client_name: string
  game_mode: GameMode
  starting_coins: number
  default_round_seconds: number | null
  traits: TraitInput[] | null
}

/** Row of the admin room list. */
export interface RoomListItem extends Room {
  participant_count: number
  round_count: number
  trait_count: number
  is_live: boolean
  locked: boolean
}
