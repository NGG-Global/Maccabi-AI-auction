'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { AuctionRound, Bid, Participant } from '@/lib/types'
import {
  computeCurrentRoundAnalytics,
  computeCumulativeAnalytics,
  generateDiscussionInsight,
  type CurrentRoundAnalytics,
  type CumulativeGameAnalytics,
  type RealtimeConnectionStatus,
} from '@/lib/game/analytics'

// ─── Return type ──────────────────────────────────────────────────────────────

export interface AdminRealtimeAnalyticsResult {
  currentRoundAnalytics: CurrentRoundAnalytics
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

export function useAdminRealtimeAnalytics(eventId: string): AdminRealtimeAnalyticsResult {
  // Single, stable Supabase client instance
  const supabase = useMemo(() => createClient(), [])

  // Raw data state
  const [participants, setParticipants] = useState<Participant[]>([])
  const [currentRound, setCurrentRound] = useState<AuctionRound | null>(null)
  const [currentBids, setCurrentBids] = useState<Bid[]>([])
  const [closedRounds, setClosedRounds] = useState<AuctionRound[]>([])
  const [bidAmountsByRound, setBidAmountsByRound] = useState<Record<string, number[]>>({})

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

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchParticipants = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('participants')
      .select('*')
      .eq('event_id', eventId)

    if (!mountedRef.current) return
    if (err) {
      setError(`שגיאה בטעינת משתתפים: ${err.message}`)
      return
    }
    setParticipants((data ?? []) as Participant[])
  }, [supabase, eventId])

  const fetchCurrentRoundBids = useCallback(async (roundId: string | null | undefined) => {
    if (!roundId) {
      if (mountedRef.current) setCurrentBids([])
      return
    }
    const { data, error: err } = await supabase
      .from('bids')
      .select('*, participant:participants(id, display_name)')
      .eq('round_id', roundId)
      .order('amount', { ascending: false })

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

  const fetchRoundsAndBids = useCallback(async () => {
    // Fetch the most recent open or closed round (with trait + winner joined)
    const { data: recentRounds, error: recentErr } = await supabase
      .from('auction_rounds')
      .select('*, trait:traits(*), winner:participants!auction_rounds_winner_participant_id_fkey(*)')
      .eq('event_id', eventId)
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
      .select('*, trait:traits(*), winner:participants!auction_rounds_winner_participant_id_fkey(*)')
      .eq('event_id', eventId)
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
  }, [supabase, eventId, fetchCurrentRoundBids, fetchClosedRoundBids])

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

    const channel = supabase
      .channel(`admin-analytics-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
        fetchCurrentRoundBids(currentRoundRef.current?.id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_rounds' }, () => {
        fetchRoundsAndBids()
        fetchParticipants() // wallet balances update when a round closes
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
        fetchParticipants()
      })
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
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived analytics (pure, memoised) ───────────────────────────────────

  const currentRoundAnalytics = useMemo(
    () => computeCurrentRoundAnalytics(currentRound, currentBids, participants.length),
    [currentRound, currentBids, participants.length],
  )

  const cumulativeAnalytics = useMemo(
    () => computeCumulativeAnalytics(participants, closedRounds, bidAmountsByRound),
    [participants, closedRounds, bidAmountsByRound],
  )

  const discussionInsight = useMemo(
    () => generateDiscussionInsight(currentRoundAnalytics),
    [currentRoundAnalytics],
  )

  return {
    currentRoundAnalytics,
    cumulativeAnalytics,
    currentBids,
    discussionInsight,
    connectionStatus,
    lastSyncedAt,
    loading,
    error,
  }
}
