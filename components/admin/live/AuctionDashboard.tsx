'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { DB_SCHEMA } from '@/lib/supabase/schema'
import type { Room, AuctionRound, Trait, Bid, Participant } from '@/lib/types'
import { EMBED, ROUND_SELECT } from '@/lib/supabase/embeds'
import { useRoundTimer } from '@/lib/hooks/useRoundTimer'
import { TraitQueue } from './TraitQueue'
import JoinShare from '@/components/admin/JoinShare'
import ResetControl from '@/components/admin/ResetControl'
import LiveWindowBadge from './LiveWindowBadge'
import LiveFrame, { DrawerSection, type LiveMessage } from './LiveFrame'
import type { LiveShellProps } from './LiveWrapper'
import StageMeta from './StageMeta'
import StageButton, { StageConfirm } from './StageButton'
import LobbyScene from './LobbyScene'
import BidLadder, { type LadderBid } from './BidLadder'
import LotQueue, { type QueueLot } from './LotQueue'
import LotTicket from '@/components/game/LotTicket'
import NumberRoller from '@/components/game/NumberRoller'
import ParticipantMark from '@/components/game/ParticipantMark'
import SoldStamp from '@/components/game/SoldStamp'
import CountdownLine from '@/components/game/CountdownLine'
import StatusPill from '@/components/game/StatusPill'
import { Button } from '@/components/game/ui'
import { UNIT_LABEL, fmt } from '@/components/game/units'
import { useReducedMotion } from '@/components/game/useReducedMotion'

interface Props extends LiveShellProps {
  room: Room
  traits: Trait[]
  initialRound: AuctionRound | null
}

interface BidRow extends Bid {
  participant: Participant
}

interface ClosedLot { id: string; trait_id: string; winning_bid_amount: number | null; created_at: string }

interface WallPerson { id: string; name: string; up: boolean }

/** The closing moment: two cues, the strike, then the sold state. */
type Closing = null | 'cue1' | 'cue2' | 'strike' | 'sold'

export default function AuctionDashboard({ room, traits, initialRound, drawerOpen, onDrawerClose }: Props) {
  const [currentRound, setCurrentRound] = useState<AuctionRound | null>(initialRound)
  const [bids, setBids] = useState<BidRow[]>([])
  const [people, setPeople] = useState<WallPerson[]>([])
  const [closedLots, setClosedLots] = useState<ClosedLot[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<LiveMessage | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing] = useState<Closing>(null)
  const [closeResult, setCloseResult] = useState<{ price: number; winnerName: string | null } | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const reduce = useReducedMotion()
  // Keep a ref to currentRound so realtime callbacks always see the latest value
  const currentRoundRef = useRef<AuctionRound | null>(initialRound)
  const closingTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  // Store traits state locally so we can update is_used without page refresh
  const [localTraits, setLocalTraits] = useState<Trait[]>(traits)

  // Drag-and-drop queue: the facilitator's order of the unused traits.
  // Derived from localTraits so a reset (is_used back to false) restores
  // every lot, and a traits refresh never drops the custom order.
  const [queueOrder, setQueueOrder] = useState<string[]>(() =>
    traits.filter(t => !t.is_used).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(t => t.id)
  )
  const traitQueue = useMemo(() => {
    const pos = new Map(queueOrder.map((id, i) => [id, i]))
    const rank = (t: Trait) => pos.get(t.id) ?? 1_000_000 + (t.sort_order ?? 0)
    return localTraits.filter(t => !t.is_used).sort((a, b) => rank(a) - rank(b))
  }, [localTraits, queueOrder])
  const reorderQueue = (next: Trait[]) => setQueueOrder(next.map(t => t.id))

  const usedTraits = localTraits.filter(t => t.is_used)

  /* ── keep ref in sync so realtime callbacks are never stale ── */
  useEffect(() => { currentRoundRef.current = currentRound }, [currentRound])

  /* ── timer: elapsed, plus a countdown when the room sets a round length ── */
  const timer = useRoundTimer(
    currentRound?.opened_at ?? null,
    currentRound?.status === 'open',
    room.default_round_seconds,
  )

  const fetchBids = useCallback(async (roundId: string) => {
    const { data } = await supabase
      .from('bids')
      .select(`*, ${EMBED.bidParticipant}`)
      .eq('round_id', roundId)
      .order('amount', { ascending: false })
      .order('updated_at', { ascending: true }) // same order as the tie-break: first to reach the amount leads
    setBids((data ?? []) as BidRow[])
  }, [supabase])

  const fetchPeople = useCallback(async () => {
    const { data } = await supabase
      .from('participants')
      .select('id, display_name, created_at')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
    setPeople(((data ?? []) as Array<{ id: string; display_name: string }>).map(p => ({ id: p.id, name: p.display_name, up: true })))
  }, [supabase, room.id])

  const fetchClosedLots = useCallback(async () => {
    const { data } = await supabase
      .from('auction_rounds')
      .select('id, trait_id, winning_bid_amount, created_at')
      .eq('room_id', room.id)
      .eq('status', 'closed')
      .order('created_at', { ascending: true })
    setClosedLots((data ?? []) as ClosedLot[])
  }, [supabase, room.id])

  const refreshRound = useCallback(async () => {
    const { data: rounds } = await supabase
      .from('auction_rounds')
      .select(ROUND_SELECT)
      .eq('room_id', room.id)
      .in('status', ['open', 'closed'])
      .order('created_at', { ascending: false })
      .limit(1)
    const round = (rounds?.[0] ?? null) as AuctionRound | null
    currentRoundRef.current = round
    setCurrentRound(round)
    if (round) fetchBids(round.id)
    else setBids([])
    fetchClosedLots()
  }, [supabase, room.id, fetchBids, fetchClosedLots])

  const fetchTraits = useCallback(async () => {
    const { data } = await supabase.from('traits').select('*').eq('room_id', room.id).order('sort_order')
    if (data) setLocalTraits(data as Trait[])
  }, [supabase, room.id])

  useEffect(() => {
    const timers = closingTimers.current
    // Deferred a tick so the first load never sets state inside the effect itself.
    const first = setTimeout(() => {
      fetchPeople()
      fetchClosedLots()
      // The traits prop is from page load; is_used may have changed since
      // (e.g. a reset before switching back from allocation mode).
      fetchTraits()
      if (initialRound) fetchBids(initialRound.id)
    }, 0)

    // Throttle timer — coalesce rapid bid events into a single fetch without
    // letting a continuous stream of bids postpone the refresh indefinitely
    let bidsTimer: ReturnType<typeof setTimeout> | null = null
    const debouncedFetchBids = () => {
      if (bidsTimer) return
      bidsTimer = setTimeout(() => {
        bidsTimer = null
        if (currentRoundRef.current) fetchBids(currentRoundRef.current.id)
      }, 250)
    }

    const channel = supabase
      .channel(`admin-controls-${room.id}`)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'bids', filter: `room_id=eq.${room.id}` }, debouncedFetchBids)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'auction_rounds', filter: `room_id=eq.${room.id}` }, refreshRound)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'participants', filter: `room_id=eq.${room.id}` }, fetchPeople)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'traits', filter: `room_id=eq.${room.id}` }, fetchTraits)
      .subscribe()

    return () => {
      clearTimeout(first)
      if (bidsTimer) clearTimeout(bidsTimer)
      timers.forEach(clearTimeout)
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function showMsg(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleOpenRound() {
    const nextTrait = traitQueue[0]
    if (!nextTrait) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/open-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, traitId: nextTrait.id }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error ?? 'שגיאה'); return }
      setClosing(null)
      setCloseResult(null)
      await refreshRound()
    } catch { showMsg('error', 'שגיאת רשת') }
    finally { setLoading(false) }
  }

  /**
   * Closes the round on the server, and only then plays the closing moment:
   * "N · פעם ראשונה", "N · פעם שנייה", the strike, the sold state.
   */
  async function handleCloseRound() {
    if (!currentRound || currentRound.status !== 'open' || closing) return
    setLoading(true)
    setConfirmClose(false)
    try {
      const res = await fetch('/api/admin/close-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, roundId: currentRound.id }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error ?? 'שגיאה בסגירת הסבב'); return }
      const winnerId: string | null = data.winnerId ?? null
      const price: number = Number(data.winningAmount ?? 0)
      const winnerName = winnerId ? bids.find(b => b.participant_id === winnerId)?.participant?.display_name ?? null : null
      setCloseResult({ price, winnerName })
      const beat = reduce ? 10 : 950
      const later = (fn: () => void, ms: number) => closingTimers.current.push(setTimeout(fn, ms))
      if (winnerName) {
        setClosing('cue1')
        later(() => setClosing('cue2'), beat)
        later(() => setClosing('strike'), beat * 2)
        later(() => setClosing('sold'), beat * 2 + 900)
      } else {
        setClosing('sold')
      }
      refreshRound()
    } catch { showMsg('error', 'שגיאת רשת') }
    finally { setLoading(false) }
  }

  async function handleAfterReset() {
    showMsg('success', 'הסשן אופס')
    setCurrentRound(null)
    setBids([])
    setClosing(null)
    setCloseResult(null)
    await refreshRound()
    await fetchPeople()
  }

  const leader = bids[0] ?? null
  const tiedAtTop = leader ? bids.filter(b => b.amount === leader.amount).length : 0
  const highestBid = leader?.amount ?? 0
  const isOpen = currentRound?.status === 'open'
  const isClosed = currentRound?.status === 'closed'
  // The round scene stays while the closing moment plays, even before the realtime refresh lands.
  const soldView = closing === 'sold' || (closing === null && isClosed)
  const striking = closing === 'strike'
  const price = closeResult?.price ?? currentRound?.winning_bid_amount ?? highestBid
  const winnerName = closeResult?.winnerName ?? currentRound?.winner?.display_name ?? leader?.participant?.display_name ?? null
  const unsold = soldView && !winnerName

  /* ── lots on the stage: sold ones in play order, the live one, then the facilitator's queue ── */
  const traitById = useMemo(() => new Map(localTraits.map(t => [t.id, t])), [localTraits])
  const lots: QueueLot[] = []
  const seen = new Set<string>()
  for (const c of closedLots) {
    const t = traitById.get(c.trait_id)
    if (!t || seen.has(t.id)) continue
    seen.add(t.id)
    lots.push({ id: t.id, title: t.title, state: c.winning_bid_amount ? 'sold' : 'unsold', price: c.winning_bid_amount })
  }
  if (currentRound?.trait && !seen.has(currentRound.trait.id)) {
    seen.add(currentRound.trait.id)
    lots.push({ id: currentRound.trait.id, title: currentRound.trait.title, state: isOpen ? 'live' : unsold ? 'unsold' : 'sold', price })
  }
  for (const t of traitQueue) {
    if (seen.has(t.id)) continue
    seen.add(t.id)
    lots.push({ id: t.id, title: t.title, state: 'waiting' })
  }
  const lotIndex = currentRound ? lots.findIndex(l => l.id === currentRound.trait?.id) + 1 : 0

  const ladder: LadderBid[] = bids.map(b => ({ key: `${b.participant_id}-${b.amount}`, participantId: b.participant_id, name: b.participant?.display_name ?? '—', amount: b.amount }))

  const queueAction = confirmClose ? (
    <StageConfirm question="לסגור את הסבב? ההצעה הגבוהה תזכה." onConfirm={handleCloseRound} onCancel={() => setConfirmClose(false)} busy={loading} />
  ) : isOpen && closing === null ? (
    <StageButton check onClick={() => setConfirmClose(true)} disabled={loading}>סגירת הסבב</StageButton>
  ) : closing !== null && closing !== 'sold' ? (
    <StageButton disabled>סוגרים…</StageButton>
  ) : traitQueue.length > 0 ? (
    <StageButton onClick={handleOpenRound} disabled={loading}>{loading ? 'פותחים…' : 'פתיחת הפריט הבא'}</StageButton>
  ) : (
    <StageButton disabled>כל הפריטים נמכרו</StageButton>
  )

  const drawer = (
    <>
      <DrawerSection title="חלון ההפעלה">
        <LiveWindowBadge roomId={room.id} activeUntil={room.active_until ?? null} status={room.status} />
      </DrawerSection>
      <DrawerSection title="מצב">
        <div className="flex items-center justify-between gap-2">
          {isOpen ? <StatusPill kind="open">סבב פתוח</StatusPill> : isClosed ? <StatusPill kind="closed">הסבב נסגר</StatusPill> : <StatusPill kind="draft">ממתינים</StatusPill>}
          <span className="text-[13px] text-ink-3">{people.length} משתתפים · {bids.length} הצעות</span>
        </div>
        {!currentRound && (
          <Button variant="primary" size="sm" onClick={handleOpenRound} disabled={loading || traitQueue.length === 0 || isOpen} className="w-full">
            {traitQueue[0] ? `פתיחת סבב: ${traitQueue[0].title}` : 'אין פריטים לפתיחה'}
          </Button>
        )}
      </DrawerSection>
      <DrawerSection title="הצטרפות">
        <JoinShare slug={room.slug} />
      </DrawerSection>
      <DrawerSection>
        <TraitQueue queue={traitQueue} usedTraits={usedTraits} disabled={loading || isOpen} onReorder={reorderQueue} />
      </DrawerSection>
      <DrawerSection title="תרגול ואיפוס">
        <ResetControl roomId={room.id} disabled={loading} onReset={handleAfterReset} onError={text => showMsg('error', text)} />
      </DrawerSection>
    </>
  )

  return (
    <LiveFrame drawer={drawer} drawerOpen={drawerOpen} onDrawerClose={onDrawerClose} message={message} busy={loading}>
      <div className="flex h-full flex-col px-24 pb-14 pt-16">
        <StageMeta room={room} live={isOpen} note={<><span className="num">{people.length}</span> משתתפים</>} />

        {/* Waiting for the first lot: the lobby with the QR */}
        {!currentRound && (
          <div className="min-h-0 flex-1 pt-6">
            <LobbyScene
              headline="המכירה נפתחת"
              sub={<><span className="num">{fmt(room.starting_coins)}</span> {UNIT_LABEL} לכל אחד, <span className="num">{localTraits.length}</span> פריטים. מה שווה לכם יותר?</>}
              count={people.length}
              countLabel="נכנסו"
              people={people}
              slug={room.slug}
              note="סורקים את הקוד, נרשמים בשם, וממתינים לפתיחת הפריט הראשון."
              action={
                <StageButton onClick={handleOpenRound} disabled={loading || traitQueue.length === 0}>
                  {loading ? 'פותחים…' : 'פתיחת סבב'}
                </StageButton>
              }
            />
          </div>
        )}

        {/* The round: open, closing, or sold */}
        {currentRound && (
          <div className="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_430px] grid-rows-[minmax(0,1fr)_132px] gap-x-[72px] gap-y-7 pt-7">
            <div className={`relative flex min-w-0 flex-col justify-center gap-11 ${striking && !reduce ? 'gm-shake' : ''}`}>
              <LotTicket variant="projector" index1={lotIndex || 1} total={lots.length} category={currentRound.trait?.category} title={currentRound.trait?.title ?? ''} />

              <div>
                <div className="relative flex min-h-[300px] items-center gap-11">
                  {/* The price token */}
                  <div className="flex flex-row-reverse items-center gap-9">
                    <span className="max-w-[7em] text-[30px] font-medium text-ink-2">
                      {soldView ? (unsold ? 'הפריט נשאר ללא הצעות' : 'מחיר הסגירה') : timer.overtime && room.default_round_seconds ? 'הזמן נגמר · ממתינים לסגירת הסבב' : 'ההצעה הגבוהה'}
                    </span>
                    <div className={`relative flex h-[300px] w-[300px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border-[5px] border-ink text-[118px] font-bold leading-none text-ink shadow-piece-xl transition-colors duration-[400ms] ${soldView ? 'bg-card' : 'bg-sun'}`}>
                      <span aria-hidden="true" className="pointer-events-none absolute inset-4 rounded-full border-4 border-dashed border-ink/30" />
                      <NumberRoller value={soldView ? price : highestBid} />
                      <span className="text-[28px] font-semibold leading-none">{UNIT_LABEL}</span>
                    </div>
                  </div>

                  {/* The leader, or the sticker that takes its place */}
                  {!soldView && !striking && leader && (
                    <div key={`${leader.participant_id}-${leader.amount}`} className="flex items-center gap-[22px] transition-[opacity,transform] duration-300">
                      <span className="gm-pop inline-flex"><ParticipantMark name={leader.participant?.display_name} size={108} tone="sky" shadow /></span>
                      <div className="flex flex-col gap-0.5">
                        <b className="text-[58px] font-bold leading-none text-ink">{leader.participant?.display_name}</b>
                        <span className="text-[24px] text-ink-2">{tiedAtTop > 1 ? 'בראש המכירה · הגיע לסכום ראשון' : 'בראש המכירה'}</span>
                      </div>
                    </div>
                  )}
                  {(striking || soldView) && (
                    <div className="absolute bottom-[30px] left-0 z-[7]">
                      <SoldStamp text={unsold ? 'לא נמכרה' : 'נמכר'} sub={unsold ? undefined : `ל${winnerName}`} animate={striking || (closing === 'sold')} muted={unsold} />
                    </div>
                  )}
                  {striking && !reduce && (
                    <span aria-hidden="true" className="gm-ring absolute bottom-[110px] left-[230px] z-[6] -ml-5 -mt-5 h-10 w-10 rounded-full border-4 border-ink" />
                  )}
                </div>
                <CountdownLine timer={timer} roundSeconds={room.default_round_seconds} closed={soldView || striking} />
              </div>
            </div>

            <BidLadder bids={ladder} />

            <LotQueue lots={lots} action={queueAction} />

            {/* Cues and flash of the closing moment */}
            {(closing === 'cue1' || closing === 'cue2') && (
              <div key={closing} aria-live="assertive" className="gm-cue pointer-events-none absolute inset-x-0 bottom-[340px] z-[5] mx-auto w-max rounded-[26px] border-4 border-ink bg-card px-10 pb-[18px] pt-2.5 text-center text-[64px] font-bold text-ink shadow-piece-xl">
                <span className="num">{fmt(price)}</span> · {closing === 'cue1' ? 'פעם ראשונה' : 'פעם שנייה'}
              </div>
            )}
            {striking && (
              <div aria-hidden="true" className="gm-flash pointer-events-none absolute -inset-24 z-[6] bg-[radial-gradient(ellipse_60%_60%_at_50%_55%,rgba(255,200,61,.55),rgba(255,107,74,.18)_40%,transparent_70%)]" />
            )}
            {soldView && winnerName && (
              <p className="sr-only" role="status">נמכר ל{winnerName} במחיר {fmt(price)} {UNIT_LABEL}</p>
            )}
          </div>
        )}
      </div>
    </LiveFrame>
  )
}
