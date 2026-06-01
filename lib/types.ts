export type EventStatus = 'draft' | 'active' | 'ended'
export type RoundStatus = 'draft' | 'open' | 'closed' | 'cancelled'
export type WalletReason = 'initial_grant' | 'round_bid_payment' | 'admin_adjustment' | 'reset'

export interface Event {
  id: string
  slug: string
  name: string
  status: EventStatus
  current_round_id: string | null
  created_at: string
}

export interface Participant {
  id: string
  event_id: string
  display_name: string
  wallet_balance: number
  session_token: string
  created_at: string
  last_seen_at: string | null
}

export interface Trait {
  id: string
  event_id: string
  title: string
  description: string
  category: string | null
  sort_order: number | null
  is_used: boolean
  created_at: string
}

export interface AuctionRound {
  id: string
  event_id: string
  trait_id: string
  status: RoundStatus
  opened_at: string | null
  closed_at: string | null
  winner_participant_id: string | null
  winning_bid_amount: number | null
  created_at: string
  // joined
  trait?: Trait
  winner?: Participant
}

export interface Bid {
  id: string
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
  event_id: string
  participant_id: string
  round_id: string | null
  amount_delta: number
  reason: WalletReason
  created_at: string
}
