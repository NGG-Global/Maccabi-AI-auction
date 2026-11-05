'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { DB_SCHEMA } from '@/lib/supabase/schema'
import type { AuctionRound, Participant, Bid, PublicRoom } from '@/lib/types'
import { ROUND_SELECT } from '@/lib/supabase/embeds'
import { useRoundTimer } from '@/lib/hooks/useRoundTimer'
import { PlaySkeleton, PlayError, PhoneShell, RulesList } from './PlayShell'
import WalletBar from '@/components/game/WalletBar'
import LotTicket from '@/components/game/LotTicket'
import NumberRoller from '@/components/game/NumberRoller'
import Stepper from '@/components/game/Stepper'
import SoldStamp from '@/components/game/SoldStamp'
import CountdownLine from '@/components/game/CountdownLine'
import { CTA, ErrorText } from '@/components/game/ui'
import { UNIT_LABEL, defaultBidStep, fmt, lotNo } from '@/components/game/units'

interface GameState {
  participant: Participant | null
  currentRound: AuctionRound | null
  myBid: Bid | null
  loading: boolean
  error: string | null
}

interface RoundStats {
  bidderCount: number   // have a bid in this round
  noBidCount: number    // wallet > 0 but no bid yet
  foldedCount: number   // wallet = 0, cannot bid
  highestBid: number
  leaderId: string | null
  isLeading: boolean    // current participant would win if the round closed now
  isTiedBehind: boolean // matches the top bid, but someone reached it first
}

const EMPTY_STATS: RoundStats = { bidderCount: 0, noBidCount: 0, foldedCount: 0, highestBid: 0, leaderId: null, isLeading: false, isTiedBehind: false }

interface Props {
  room: PublicRoom
  participantId: string
  sessionToken: string
}

export default function AuctionPlay({ room, participantId, sessionToken }: Props) {
  const [state, setState] = useState<GameState>({ participant: null, currentRound: null, myBid: null, loading: true, error: null })
  const [roundStats, setRoundStats] = useState<RoundStats>(EMPTY_STATS)
  const [bidInput, setBidInput] = useState('')
  const [bidSubmitting, setBidSubmitting] = useState(false)
  const [bidError, setBidError] = useState<string | null>(null)
  const [bidSuccess, setBidSuccess] = useState(false)
  // Display names of leading bidders, fetched once per participant.
  const [leaderNames, setLeaderNames] = useState<Record<string, string>>({})
  const highestRef = useRef(0)
  const bidSoundRef = useRef<HTMLAudioElement | null>(null)
  const fetchSeqRef = useRef(0)
  const currentRoundRef = useRef<AuctionRound | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    bidSoundRef.current = new Audio('/bid-success.mp3')
    bidSoundRef.current.preload = 'auto'
  }, [])

  // One round trip (get_round_stats, migration 012) instead of downloading
  // every participant of the room on each bid.
  const fetchRoundStats = useCallback(async (roundId: string, roomId: string, participantId: string) => {
    const { data } = await supabase.rpc('get_round_stats', {
      p_room_id: roomId,
      p_round_id: roundId,
      p_participant_id: participantId,
    })
    const row = data?.[0]
    if (!row) return
    const highestBid = row.highest_bid ?? 0
    const myAmount = row.my_amount ?? 0
    const leaderId: string | null = row.leader_participant_id ?? null
    // Leading = first in tie-break order. Matching the top bid after someone
    // else reached it is a tie this participant would lose.
    const isLeading = myAmount > 0 && leaderId === participantId
    const isTiedBehind = myAmount > 0 && myAmount === highestBid && !isLeading
    setRoundStats({
      bidderCount: row.bidder_count ?? 0,
      noBidCount: row.no_bid_count ?? 0,
      foldedCount: row.folded_count ?? 0,
      highestBid,
      leaderId,
      isLeading,
      isTiedBehind,
    })
    // The amount to send follows the highest bid up: a typed amount is
    // dropped only when the room overtook it.
    if (highestBid !== highestRef.current) {
      highestRef.current = highestBid
      setBidInput(prev => (prev !== '' && parseInt(prev, 10) > highestBid ? prev : ''))
    }
  }, [supabase])

  // The leader's name for "ההצעה הגבוהה": one small read per new leader,
  // so a stream of bids by the same person costs nothing.
  const leaderId = roundStats.leaderId
  const leaderKnown = !leaderId || leaderId === participantId || leaderId in leaderNames
  useEffect(() => {
    if (leaderKnown || !leaderId) return
    let cancelled = false
    supabase.from('participants').select('display_name').eq('id', leaderId).eq('room_id', room.id).maybeSingle<{ display_name: string }>()
      .then(({ data }) => {
        if (cancelled || !data) return
        setLeaderNames(prev => ({ ...prev, [leaderId]: data.display_name }))
      })
    return () => { cancelled = true }
  }, [leaderId, leaderKnown, room.id, supabase])
  const leaderName = leaderId ? leaderNames[leaderId] ?? null : null

  // Wallet only (a round closed, or a reset): no need to reload the round.
  const fetchParticipant = useCallback(async (participantId: string) => {
    const { data: participant } = await supabase
      .from('participants').select('*').eq('id', participantId).eq('room_id', room.id).maybeSingle<Participant>()
    if (participant) setState(prev => ({ ...prev, participant }))
  }, [supabase, room.id])

  const fetchState = useCallback(async (participantId: string) => {
    // Responses can arrive out of order under load; only the latest call may write state.
    const seq = ++fetchSeqRef.current
    // Participant and latest round in parallel: one round trip instead of two.
    const [{ data: participant }, { data: rounds }] = await Promise.all([
      supabase.from('participants').select('*').eq('id', participantId).eq('room_id', room.id).maybeSingle<Participant>(),
      supabase
        .from('auction_rounds')
        .select(ROUND_SELECT)
        .eq('room_id', room.id)
        .in('status', ['open', 'closed'])
        .order('created_at', { ascending: false })
        .limit(1),
    ])
    if (!participant) {
      setState(prev => ({ ...prev, loading: false, error: 'המשתתף לא נמצא (ייתכן שהסשן אופס). סרקו את קוד ה־QR והירשמו מחדש.' }))
      return
    }

    const round = (rounds?.[0] ?? null) as AuctionRound | null

    let myBid: Bid | null = null
    if (round) {
      const { data: bid } = await supabase
        .from('bids').select('*').eq('round_id', round.id).eq('participant_id', participantId).maybeSingle<Bid>()
      myBid = bid ?? null
    }

    if (seq !== fetchSeqRef.current) return
    if (currentRoundRef.current?.id !== round?.id) {
      // A fresh lot starts from a fresh amount.
      highestRef.current = 0
      setBidInput('')
      setBidSuccess(false)
      setBidError(null)
    }
    currentRoundRef.current = round
    setState(prev => ({ ...prev, participant, currentRound: round, myBid, loading: false }))

    if (round?.status === 'open') {
      fetchRoundStats(round.id, room.id, participantId)
    } else {
      setRoundStats(EMPTY_STATS)
    }
  }, [supabase, fetchRoundStats, room.id])

  useEffect(() => {
    // Deferred a tick so the first load never sets state inside the effect itself.
    const first = setTimeout(() => fetchState(participantId), 0)

    // Each kind of change refreshes only what it affects. With ~100 phones,
    // a bid elsewhere in the room used to cost every phone a full reload
    // (3 queries + the participant list); now it is one small RPC, at most
    // twice a second, and a steady stream of bids cannot postpone it.
    let statsTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleStats = () => {
      if (statsTimer) return
      statsTimer = setTimeout(() => {
        statsTimer = null
        const round = currentRoundRef.current
        if (round?.status === 'open') fetchRoundStats(round.id, room.id, participantId)
      }, 500)
    }
    let stateTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleState = () => {
      if (stateTimer) return
      stateTimer = setTimeout(() => {
        stateTimer = null
        fetchState(participantId)
      }, 300)
    }

    // Only this room's rounds and bids reach this phone.
    const channel = supabase.channel(`play-${room.id}-${participantId}`)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'auction_rounds', filter: `room_id=eq.${room.id}` }, scheduleState)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'bids', filter: `room_id=eq.${room.id}` }, scheduleStats)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'participants', filter: `id=eq.${participantId}` }, () => fetchParticipant(participantId))
      .subscribe()
    return () => {
      clearTimeout(first)
      if (statsTimer) clearTimeout(statsTimer)
      if (stateTimer) clearTimeout(stateTimer)
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { participant, currentRound, myBid, loading, error } = state
  const timer = useRoundTimer(currentRound?.opened_at ?? null, currentRound?.status === 'open', room.default_round_seconds)

  const balance = participant?.wallet_balance ?? 0
  const highest = roundStats.highestBid
  const step = room.bid_step ?? defaultBidStep('auction', room.starting_coins)
  // The amount to send: free text, moved by the stepper, never below the
  // lowest raise that would lead. An empty input shows the suggested raise.
  const minAmount = Math.max(highest + 1, (myBid?.amount ?? 0) + 1, 1)
  const suggested = Math.min(balance, Math.max(minAmount, highest + step))
  const amount = bidInput === '' ? suggested : parseInt(bidInput, 10) || 0

  async function handleBidSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isNaN(amount) || amount < 1) return
    setBidSubmitting(true)
    setBidError(null)
    setBidSuccess(false)
    try {
      const res = await fetch('/api/bid/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, roomId: room.id, roundId: currentRound?.id, amount }),
      })
      const data = await res.json()
      if (!res.ok) { setBidError(data.error ?? 'שגיאה') }
      else {
        setState(prev => ({
          ...prev,
          myBid: {
            id: 'optimistic',
            room_id: room.id,
            round_id: currentRound?.id ?? '',
            participant_id: prev.participant?.id ?? '',
            amount,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }))
        setBidSuccess(true)
        if (bidSoundRef.current) {
          bidSoundRef.current.currentTime = 0
          bidSoundRef.current.play().catch(() => {})
        }
        if (navigator.vibrate) navigator.vibrate(20)
        if (currentRound) fetchRoundStats(currentRound.id, room.id, participantId)
      }
    } catch { setBidError('שגיאת רשת. נסו שוב.') }
    finally { setBidSubmitting(false) }
  }

  if (loading) return <PlaySkeleton />
  if (error || !participant) return <PlayError message={error ?? 'שגיאה לא צפויה'} />

  const isOpen = currentRound?.status === 'open'
  const isClosed = currentRound?.status === 'closed'
  const iWon = isClosed && currentRound?.winner_participant_id === participant.id
  const lotIndex = currentRound?.trait?.sort_order ?? 0
  const closingPrice = currentRound?.winning_bid_amount ?? null
  const winnerName = currentRound?.winner?.display_name ?? null

  const notEnough = highest + 1 > balance
  const canBid = isOpen && !roundStats.isLeading && !bidSubmitting && !notEnough && amount >= minAmount && amount <= balance
  const ctaLabel =
    bidSubmitting ? 'שולחים…'
    : roundStats.isLeading ? 'אתם מובילים'
    : notEnough ? `אין מספיק ${UNIT_LABEL}`
    : `שליחת הצעה · ${fmt(isNaN(amount) ? 0 : amount)} ${UNIT_LABEL}`

  const status =
    roundStats.isLeading ? { text: 'אתם מובילים', lead: true }
    : roundStats.isTiedBehind ? { text: 'שוויון: זוכה מי שהציע את הסכום ראשון', lead: false }
    : myBid ? { text: 'עקפו אותך', lead: false }
    : { text: 'טרם הצעתם', lead: false }

  const footer = isOpen ? (
    <form onSubmit={handleBidSubmit} className="flex flex-col gap-3">
      <Stepper
        value={isNaN(amount) ? 0 : amount}
        inputValue={fmt(bidInput === '' ? suggested : amount)}
        onInput={raw => { setBidInput(raw); setBidSuccess(false) }}
        inputLabel="סכום ההצעה"
        onDown={() => setBidInput(String(Math.max(minAmount, amount - step)))}
        onUp={() => setBidInput(String(Math.min(balance, amount + step)))}
        downDisabled={roundStats.isLeading || amount - step < minAmount}
        upDisabled={roundStats.isLeading || amount + step > balance}
        downLabel={`הורדה ב־${fmt(step)} ${UNIT_LABEL}`}
        upLabel={`העלאה ב־${fmt(step)} ${UNIT_LABEL}`}
        caption="ההצעה שלך"
      />
      {bidError && <ErrorText>{bidError}</ErrorText>}
      <button type="submit" disabled={!canBid} className={CTA}>{ctaLabel}</button>
      <p className="m-0 min-h-[22px] text-center text-[15px] text-ink-3">
        {bidSuccess ? <span className="font-semibold text-tomato-text">ההצעה נשלחה</span> : 'המטבעות יורדים מהיתרה רק אם תזכו בפריט.'}
      </p>
    </form>
  ) : undefined

  return (
    <PhoneShell footer={footer}>
      <WalletBar remaining={balance} total={room.starting_coins} unitLabel={UNIT_LABEL} label="נשארו לך" name={participant.display_name} />

      {/* Waiting */}
      {!currentRound && (
        <div className="gm-fade flex flex-1 flex-col justify-center gap-6 py-6">
          <div className="text-center">
            <p className="m-0 text-[34px] font-bold leading-tight text-ink">ממתינים להתחלה</p>
            <p className="mt-2 mb-0 text-[17px] text-ink-2">הפריט הבא ייפתח בקרוב</p>
          </div>
          <div className="rounded-[24px] border-[3px] border-ink bg-card px-5 py-5 shadow-piece-md">
            <RulesList rules={[
              'בכל סבב מוצג פריט אחד.',
              'שולחים הצעה ומעלים אותה כל עוד הסבב פתוח.',
              'רק הזוכה משלם את הצעתו.',
              'בשוויון זוכה מי שהציע את הסכום ראשון.',
            ]} />
          </div>
        </div>
      )}

      {/* Round closed result */}
      {isClosed && currentRound && (
        <div key={`closed-${currentRound.id}`} className="gm-rise flex flex-1 flex-col gap-4">
          <LotTicket index1={lotIndex} category={currentRound.trait?.category} title={currentRound.trait?.title ?? ''} />
          <div className="my-auto flex flex-col items-center gap-3 px-2 py-6 text-center">
            {winnerName ? (
              <>
                <SoldStamp size="phone" text={iWon ? 'נמכר לך' : 'נמכר'} animate />
                <h4 className="mt-5 mb-0 text-[34px] font-bold leading-[1.1] text-ink">
                  {iWon ? `זכית בפריט ${lotNo(lotIndex)}` : `ל${winnerName}`}
                </h4>
                <p className="m-0 text-[19px] leading-[1.45] text-ink-2">
                  {iWon
                    ? <><span className="num">{fmt(closingPrice ?? 0)}</span> {UNIT_LABEL} ירדו מהיתרה שלך.</>
                    : <>במחיר <span className="num">{fmt(closingPrice ?? 0)}</span> {UNIT_LABEL}. לא הוצאת כלום בסבב הזה.</>}
                </p>
                {!iWon && myBid && myBid.amount === closingPrice && (
                  <p className="m-0 text-[15px] font-semibold text-tomato-text">שוויון: זוכה מי שהציע את הסכום ראשון</p>
                )}
              </>
            ) : (
              <>
                <SoldStamp size="phone" text="לא נמכרה" animate muted />
                <p className="mt-5 mb-0 text-[19px] leading-[1.45] text-ink-2">לא נשלחו הצעות על הפריט הזה.</p>
              </>
            )}
            <p className="mt-4 mb-0 text-[15px] text-ink-3">הפריט הבא ייפתח בקרוב</p>
          </div>
          <ProfileLink slug={room.slug} />
        </div>
      )}

      {/* Open round */}
      {isOpen && currentRound && (
        <div key={`open-${currentRound.id}`} className="gm-rise flex flex-col gap-4">
          <LotTicket index1={lotIndex} category={currentRound.trait?.category} title={currentRound.trait?.title ?? ''} description={currentRound.trait?.description} />

          <div className="flex items-center gap-[14px] px-1">
            <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-[3px] border-ink bg-sun text-[34px] font-bold text-ink shadow-piece">
              <NumberRoller value={highest} />
            </span>
            <span className="text-start text-[17px] leading-[1.35] text-ink-3">
              <b className="block text-[21px] font-semibold text-ink">
                {highest === 0 ? 'עדיין אין הצעות' : roundStats.isLeading ? 'ההצעה שלך' : leaderName ?? '…'}
              </b>
              {highest === 0 ? 'פתחו את המכירה' : roundStats.isLeading ? 'היא הגבוהה כרגע' : 'ההצעה הגבוהה'}
            </span>
          </div>

          <span className={`self-start rounded-full border-2 border-ink px-[14px] py-[6px] text-[17px] font-semibold ${
            status.lead ? 'bg-leaf text-ink' : 'bg-sun-tint text-sun-text'
          }`}>
            {status.text}
          </span>

          {room.default_round_seconds !== null && (
            <CountdownLine timer={timer} roundSeconds={room.default_round_seconds} size="phone" />
          )}

          <p className="m-0 text-[15px] text-ink-3">
            {roundStats.bidderCount > 0
              ? <><span className="num text-ink-2">{roundStats.bidderCount}</span> שלחו הצעה בסבב הזה</>
              : 'אף אחד עדיין לא שלח הצעה בסבב הזה'}
          </p>

          <ProfileLink slug={room.slug} />
        </div>
      )}
    </PhoneShell>
  )
}

function ProfileLink({ slug }: { slug: string }) {
  return (
    <p className="m-0 mt-auto pt-2 text-center text-[14px]">
      <a href={`/profile?room=${encodeURIComponent(slug)}`} className="text-ink-3 underline decoration-ink/30 underline-offset-4 transition-colors hover:text-ink">
        הפרופיל האישי שלכם
      </a>
    </p>
  )
}
