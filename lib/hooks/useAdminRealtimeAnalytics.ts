'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { DB_SCHEMA } from '@/lib/supabase/schema'
import type { AuctionRound, Bid, GameMode, Participant } from '@/lib/types'
import { sortRoundsByTrait } from '@/lib/game/allocation'
import { EMBED, ROUND_SELECT } from '@/lib/supabase/embeds'
import {
  computeCurrentRoundAnalytics,
  computeCumulativeAnalytics,
  generateDiscussionInsight,
  type CurrentRoundAnalytics,
  type CumulativeGameAnalytics,
  type RealtimeConnectionStatus,
} from '@/lib/game/analytics'

// ─── Return type ──────────────────────────────────────────────────────────────

// Allocation mode has no single "current round": every trait is open at
// once. While it is open the overview carries participation only.
export interface AllocationOverview {
  status: 'waiting' | 'open' | 'closed'
  openedAt: string | null
  registeredParticipants: number
  allocatorCount: number      // participants with at least one allocation
  participationRate: number   // 0–100
  totalAllocated: number
}

export interface AdminRealtimeAnalyticsResult {
  currentRoundAnalytics: CurrentRoundAnalytics
  allocationOverview: AllocationOverview
  cumulativeAnalytics: CumulativeGameAnalytics
  currentBids: Bid[]
  discussionInsight: string | null
  connectionStatus: RealtimeConnectionStatus
  lastSyncedAt: string | null
  loading: boolean
  error: string | null
}

// ─── Empty/default analytics values (shown before first fetch) ─────────────────

function emptyCurrentRound(): CurrentRoundAnalytics {
  return {
    roundId: null,
    status: 'waiting',
    traitTitle: null,
    traitDescription: null,
    openedAt: null,
    registeredParticipants: 0,
    bidderCount: 0,
    participationRate: 0,
    highestBid: null,
    averageBid: null,
    medianBid: null,
    lowestBid: null,
    totalCommitted: 0,
    winnerName: null,
    winningBid: null,
  }
}

function emptyCumulative(): CumulativeGameAnalytics {
  return {
    totalStartingBudget: 0,
    totalSpent: 0,
    totalRemainingBudget: 0,
    averageRemainingWallet: 0,
    completedRounds: 0,
    traitRankings: [],
    roundSummaries: [],
    categoryBreakdown: [],
    budgetTimeline: [],
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminRealtimeAnalytics(
  roomId: string,
  gameMode: GameMode = 'auction',
  startingCoins: number = 1000,
): AdminRealtimeAnalyticsResult {
  // Single, stable Supabase client instance
  const supabase = useMemo(() => createClient(), [])

  // Raw data state
  const [participants, setParticipants] = useState<Participant[]>([])
  const [currentRound, setCurrentRound] = useState<AuctionRound | null>(null)
  const [currentBids, setCurrentBids] = useState<Bid[]>([])
  const [closedRounds, setClosedRounds] = useState<AuctionRound[]>([])
  const [bidAmountsByRound, setBidAmountsByRound] = useState<Record<string, number[]>>({})
  // Allocation mode only
  const [openAllocationRounds, setOpenAllocationRounds] = useState<AuctionRound[]>([])
  const [allocationBids, setAllocationBids] = useState<{ participant_id: string; amount: number }[]>([])
  const allocationRoundIdsRef = useRef<string[]>([])

  // UI state
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('connecting')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Ref for currentRound — avoids stale closures in subscription callbacks
  const currentRoundRef = useRef<AuctionRound | null>(null)
  useEffect(() => {
    currentRoundRef.current = currentRound
  }, [currentRound])

  // Track mount state so we never setState after unmount
  const mountedRef = useRef(true)

  // Debounce timers — coalesce rapid realtime events into a single fetch
  const bidsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roundsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const participantsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchParticipants = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', roomId)

    if (!mountedRef.current) return
    if (err) {
      setError(`שגיאה בטעינת משתתפים: ${err.message}`)
      return
    }
    setParticipants((data ?? []) as Participant[])
  }, [supabase, roomId])

  const fetchCurrentRoundBids = useCallback(async (roundId: string | null | undefined) => {
    if (!roundId) {
      if (mountedRef.current) setCurrentBids([])
      return
    }
    const { data, error: err } = await supabase
      .from('bids')
      .select(`*, ${EMBED.bidParticipant}`)
      .eq('round_id', roundId)
      .order('amount', { ascending: false })
      .order('updated_at', { ascending: true }) // same order as the tie-break: first to reach the amount leads

    if (!mountedRef.current) return
    if (err) {
      setError(`שגיאה בטעינת הצעות: ${err.message}`)
      return
    }
    setCurrentBids((data ?? []) as Bid[])
  }, [supabase])

  const fetchClosedRoundBids = useCallback(async (roundIds: string[]) => {
    if (roundIds.length === 0) {
      if (mountedRef.current) setBidAmountsByRound({})
      return
    }
    const { data, error: err } = await supabase
      .from('bids')
      .select('round_id, amount')
      .in('round_id', roundIds)

    if (!mountedRef.current) return
    if (err) {
      setError(`שגיאה בטעינת הצעות סבבים: ${err.message}`)
      return
    }

    const grouped: Record<string, number[]> = {}
    for (const row of data ?? []) {
      const r = row as { round_id: string; amount: number }
      if (!grouped[r.round_id]) grouped[r.round_id] = []
      grouped[r.round_id].push(r.amount)
    }
    setBidAmountsByRound(grouped)
  }, [supabase])

  const fetchAllocationBids = useCallback(async (roundIds: string[]) => {
    if (roundIds.length === 0) {
      if (mountedRef.current) setAllocationBids([])
      return
    }
    const { data, error: err } = await supabase
      .from('bids')
      .select('participant_id, amount')
      .in('round_id', roundIds)

    if (!mountedRef.current) return
    if (err) {
      setError(`שגיאה בטעינת החלוקה: ${err.message}`)
      return
    }
    setAllocationBids((data ?? []) as { participant_id: string; amount: number }[])
  }, [supabase])

  const fetchAllocationRounds = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('auction_rounds')
      .select(ROUND_SELECT)
      .eq('room_id', roomId)
      .in('status', ['open', 'closed'])

    if (!mountedRef.current) return
    if (err) {
      setError(`שגיאה בטעינת החלוקה: ${err.message}`)
      return
    }

    const all = sortRoundsByTrait((data ?? []) as AuctionRound[])
    const open = all.filter(r => r.status === 'open')
    const closed = all.filter(r => r.status === 'closed')
    allocationRoundIdsRef.current = all.map(r => r.id)
    setOpenAllocationRounds(open)
    setClosedRounds(closed)

    await Promise.all([
      fetchAllocationBids(allocationRoundIdsRef.current),
      fetchClosedRoundBids(closed.map(r => r.id)),
    ])
  }, [supabase, roomId, fetchAllocationBids, fetchClosedRoundBids])

  const fetchRoundsAndBids = useCallback(async () => {
    if (gameMode === 'allocation') {
      await fetchAllocationRounds()
      return
    }

    // Fetch the most recent open or closed round (with trait + winner joined)
    const { data: recentRounds, error: recentErr } = await supabase
      .from('auction_rounds')
      .select(ROUND_SELECT)
      .eq('room_id', roomId)
      .in('status', ['open', 'closed'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (!mountedRef.current) return
    if (recentErr) {
      setError(`שגיאה בטעינת סבב נוכחי: ${recentErr.message}`)
      return
    }

    const latestRound = (recentRounds?.[0] ?? null) as AuctionRound | null
    setCurrentRound(latestRound)
    currentRoundRef.current = latestRound

    // Fetch all closed rounds for cumulative analytics
    const { data: allClosed, error: closedErr } = await supabase
      .from('auction_rounds')
      .select(ROUND_SELECT)
      .eq('room_id', roomId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: true })

    if (!mountedRef.current) return
    if (closedErr) {
      setError(`שגיאה בטעינת סבבים סגורים: ${closedErr.message}`)
      return
    }

    const closed = (allClosed ?? []) as AuctionRound[]
    setClosedRounds(closed)

    // Parallel: bids for current round + bids for closed rounds
    await Promise.all([
      fetchCurrentRoundBids(latestRound?.id),
      fetchClosedRoundBids(closed.map(r => r.id)),
    ])
  }, [supabase, roomId, gameMode, fetchAllocationRounds, fetchCurrentRoundBids, fetchClosedRoundBids])

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchParticipants(), fetchRoundsAndBids()])
    if (mountedRef.current) {
      setLastSyncedAt(new Date().toISOString())
      setLoading(false)
    }
  }, [fetchParticipants, fetchRoundsAndBids])

  // ── Initial fetch + Realtime subscription ─────────────────────────────────

  useEffect(() => {
    mountedRef.current = true
    fetchAll()

    // Throttled wrappers: if 10 bids arrive in 200 ms we do one fetch, not 10.
    // The timer is not reset by later events, so a steady stream of bids
    // still refreshes the dashboard every 250 ms instead of freezing it.
    const debouncedBids = () => {
      if (bidsDebounceRef.current) return
      bidsDebounceRef.current = setTimeout(() => {
        bidsDebounceRef.current = null
        if (gameMode === 'allocation') fetchAllocationBids(allocationRoundIdsRef.current)
        else fetchCurrentRoundBids(currentRoundRef.current?.id)
      }, 250)
    }
    const debouncedRounds = () => {
      if (roundsDebounceRef.current) return
      roundsDebounceRef.current = setTimeout(() => {
        roundsDebounceRef.current = null
        fetchRoundsAndBids()
        fetchParticipants() // wallet balances update when a round closes
      }, 250)
    }
    const debouncedParticipants = () => {
      if (participantsDebounceRef.current) return
      participantsDebounceRef.current = setTimeout(() => {
        participantsDebounceRef.current = null
        fetchParticipants()
      }, 250)
    }

    // Every subscription is filtered to this room (bids carry room_id since
    // migration 010), so other rooms' traffic never reaches this screen.
    const channel = supabase
      .channel(`admin-analytics-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: DB_SCHEMA, table: 'bids', filter: `room_id=eq.${roomId}` },
        debouncedBids,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: DB_SCHEMA, table: 'auction_rounds', filter: `room_id=eq.${roomId}` },
        debouncedRounds,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: DB_SCHEMA, table: 'participants', filter: `room_id=eq.${roomId}` },
        debouncedParticipants,
      )
      .subscribe((status) => {
        if (!mountedRef.current) return
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('error')
          fetchAll().catch(() => {
            if (mountedRef.current) setError('שגיאה בסנכרון נתונים לאחר ניתוק')
          })
        } else if (status === 'CLOSED') {
          setConnectionStatus('disconnected')
        }
      })

    return () => {
      mountedRef.current = false
      if (bidsDebounceRef.current) clearTimeout(bidsDebounceRef.current)
      if (roundsDebounceRef.current) clearTimeout(roundsDebounceRef.current)
      if (participantsDebounceRef.current) clearTimeout(participantsDebounceRef.current)
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived analytics (pure, memoised) ───────────────────────────────────

  const currentRoundAnalytics = useMemo(
    () => computeCurrentRoundAnalytics(currentRound, currentBids, participants.length),
    [currentRound, currentBids, participants.length],
  )

  const cumulativeAnalytics = useMemo(
    () => computeCumulativeAnalytics(participants, closedRounds, bidAmountsByRound, startingCoins),
    [participants, closedRounds, bidAmountsByRound, startingCoins],
  )

  const discussionInsight = useMemo(
    () => (gameMode === 'allocation' ? null : generateDiscussionInsight(currentRoundAnalytics)),
    [gameMode, currentRoundAnalytics],
  )

  const allocationOverview = useMemo<AllocationOverview>(() => {
    const registeredParticipants = participants.length
    const status: AllocationOverview['status'] =
      openAllocationRounds.length > 0 ? 'open' : closedRounds.length > 0 ? 'closed' : 'waiting'
    const allocatorCount = new Set(allocationBids.map(b => b.participant_id)).size
    return {
      status,
      openedAt: openAllocationRounds[0]?.opened_at ?? null,
      registeredParticipants,
      allocatorCount,
      participationRate:
        registeredParticipants > 0 ? Math.round((allocatorCount / registeredParticipants) * 100) : 0,
      totalAllocated: allocationBids.reduce((s, b) => s + b.amount, 0),
    }
  }, [participants.length, openAllocationRounds, allocationBids, closedRounds.length])

  return {
    currentRoundAnalytics,
    allocationOverview,
    cumulativeAnalytics,
    currentBids,
    discussionInsight,
    connectionStatus,
    lastSyncedAt,
    loading,
    error,
  }
}
