/**
 * PostgREST embed strings with explicit foreign-key hints.
 *
 * Since migration 010 most child tables carry two foreign keys to the same
 * parent (the plain one and the composite (id, room_id) one that enforces
 * room isolation). PostgREST then needs to be told which to follow.
 */
export const EMBED = {
  /** auction_rounds -> traits */
  roundTrait: 'trait:traits!auction_rounds_trait_id_fkey(*)',
  /** auction_rounds -> participants (single winner) */
  roundWinner: 'winner:participants!auction_rounds_winner_participant_id_fkey(*)',
  /** auction_rounds -> round_winners -> participants (shared wins) */
  roundWinners:
    'winners:round_winners!round_winners_round_id_fkey(participant_id, amount, participant:participants!round_winners_participant_id_fkey(id, display_name))',
  /** auction_rounds -> round_winners, ids only */
  roundWinnerIds: 'winners:round_winners!round_winners_round_id_fkey(participant_id)',
  /** bids -> participants */
  bidParticipant: 'participant:participants!bids_participant_id_fkey(id, display_name)',
  /** bids -> auction_rounds */
  bidRound: 'round:auction_rounds!bids_round_id_fkey',
} as const

/** auction_rounds with trait, winner and winners. */
export const ROUND_SELECT = `*, ${EMBED.roundTrait}, ${EMBED.roundWinner}, ${EMBED.roundWinners}` as const
