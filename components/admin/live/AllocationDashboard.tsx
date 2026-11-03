'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { DB_SCHEMA } from '@/lib/supabase/schema'
import type { Room, AuctionRound, Trait } from '@/lib/types'
import { ROUND_SELECT } from '@/lib/supabase/embeds'
import JoinShare from '@/components/admin/JoinShare'
import ResetControl from '@/components/admin/ResetControl'
import LiveWindowBadge from './LiveWindowBadge'
import LiveFrame, { DrawerSection, type LiveMessage } from './LiveFrame'
import type { LiveShellProps } from './LiveWrapper'
import StageMeta from './StageMeta'
import StageButton, { StageConfirm } from './StageButton'
import LobbyScene from './LobbyScene'
import { WinnersBoard, ValuesSlide } from './ResultsSlides'
import StatusPill from '@/components/evening/StatusPill'
import { Button } from '@/components/evening/ui'
import { UNIT_LABEL, fmt } from '@/components/evening/units'
import { summarizeAllocation, sortRoundsByTrait, type AllocationBidRow } from '@/lib/game/allocation'

interface Props extends LiveShellProps {
  room: Room
  traits: Trait[]
}

interface BidRow extends AllocationBidRow {
  participant_id: string
}

interface Person { id: string; display_name: string }

type Phase = 'waiting' | 'open' | 'closed'
type Slide = 'winners' | 'values'

/**
 * Facilitator controls + projected display for the budget-allocation mode.
 * While the allocation is open the room only sees participation, not
 * amounts; the per-trait results are revealed when it closes, on two
 * slides: "הזוכים" and "מה הקבוצה מעריכה".
 */
export default function AllocationDashboard({ room, traits, drawerOpen, onDrawerClose }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [rounds, setRounds] = useState<AuctionRound[]>([])
  const [bids, setBids] = useState<BidRow[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<LiveMessage | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [slide, setSlide] = useState<Slide>('winners')
  const [replay, setReplay] = useState(0)
  const roundIdsRef = useRef<string[]>([])

  const sortedTraits = useMemo(
    () => [...traits].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [traits],
  )

  const phase: Phase =
    rounds.some(r => r.status === 'open') ? 'open' : rounds.length > 0 ? 'closed' : 'waiting'

  const fetchBids = useCallback(async (roundIds: string[]) => {
    if (roundIds.length === 0) { setBids([]); return }
    const { data } = await supabase
      .from('bids')
      .select('round_id, participant_id, amount')
      .in('round_id', roundIds)
    setBids((data ?? []) as BidRow[])
  }, [supabase])

  const fetchPeople = useCallback(async () => {
    const { data } = await supabase
      .from('participants')
      .select('id, display_name, created_at')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
    setPeople((data ?? []) as Person[])
  }, [supabase, room.id])

  const refreshRounds = useCallback(async () => {
    const { data } = await supabase
      .from('auction_rounds')
      .select(ROUND_SELECT)
      .eq('room_id', room.id)
      .in('status', ['open', 'closed'])
    const list = sortRoundsByTrait((data ?? []) as AuctionRound[])
    roundIdsRef.current = list.map(r => r.id)
    setRounds(list)
    await fetchBids(roundIdsRef.current)
  }, [supabase, room.id, fetchBids])

  useEffect(() => {
    // Deferred a tick so the first load never sets state inside the effect itself.
    const first = setTimeout(() => { refreshRounds(); fetchPeople() }, 0)

    // Throttle — with ~100 phones auto-saving, coalesce bid events into at
    // most one fetch per 250 ms without letting a steady stream postpone it.
    let bidsTimer: ReturnType<typeof setTimeout> | null = null
    const throttledFetchBids = () => {
      if (bidsTimer) return
      bidsTimer = setTimeout(() => {
        bidsTimer = null
        fetchBids(roundIdsRef.current)
      }, 250)
    }
    let roundsTimer: ReturnType<typeof setTimeout> | null = null
    const throttledRefreshRounds = () => {
      if (roundsTimer) return
      roundsTimer = setTimeout(() => {
        roundsTimer = null
        refreshRounds()
      }, 250)
    }

    const channel = supabase
      .channel(`admin-allocation-${room.id}`)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'bids', filter: `room_id=eq.${room.id}` }, throttledFetchBids)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'auction_rounds', filter: `room_id=eq.${room.id}` }, throttledRefreshRounds)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'participants', filter: `room_id=eq.${room.id}` }, fetchPeople)
      .subscribe()

    return () => {
      clearTimeout(first)
      if (bidsTimer) clearTimeout(bidsTimer)
      if (roundsTimer) clearTimeout(roundsTimer)
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: the two results slides switch with the arrow keys.
  useEffect(() => {
    if (phase !== 'closed') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setSlide('values')
      if (e.key === 'ArrowRight') setSlide('winners')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  function showMsg(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleOpen() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/open-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error ?? 'שגיאה'); return }
      await refreshRounds()
    } catch { showMsg('error', 'שגיאת רשת') }
    finally { setLoading(false) }
  }

  async function handleClose() {
    setLoading(true)
    setConfirmClose(false)
    try {
      const res = await fetch('/api/admin/close-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error ?? 'שגיאה בסגירת המכירה'); return }
      setSlide('winners')
      setReplay(k => k + 1)
      await refreshRounds()
    } catch { showMsg('error', 'שגיאת רשת') }
    finally { setLoading(false) }
  }

  async function handleAfterReset() {
    showMsg('success', 'הסשן אופס')
    await refreshRounds()
    await fetchPeople()
  }

  const submitted = useMemo(() => new Set(bids.map(b => b.participant_id)), [bids])
  const wall = useMemo(
    () => people.map(p => ({ id: p.id, name: p.display_name, up: phase === 'waiting' ? true : submitted.has(p.id) })),
    [people, submitted, phase],
  )
  const allocatorCount = submitted.size
  // summarizeAllocation ranks by total allocated, then fixed order (lib/game/allocation).
  const ranked = useMemo(
    () => (phase === 'closed' ? summarizeAllocation(rounds, bids) : []),
    [phase, rounds, bids],
  )
  const inOrder = useMemo(() => [...ranked].sort((a, b) => a.sortOrder - b.sortOrder), [ranked])
  const lotCount = phase === 'waiting' ? sortedTraits.length : rounds.length

  const drawer = (
    <>
      <DrawerSection title="חלון ההפעלה">
        <LiveWindowBadge roomId={room.id} activeUntil={room.active_until ?? null} status={room.status} />
      </DrawerSection>
      <DrawerSection title="מצב">
        <div className="flex items-center justify-between gap-2">
          {phase === 'open' ? <StatusPill kind="open">המכירה פתוחה</StatusPill> : phase === 'closed' ? <StatusPill kind="closed">המכירה נסגרה</StatusPill> : <StatusPill kind="draft">ממתינים לפתיחה</StatusPill>}
          <span className="text-[13px] text-ivory-mute">{people.length} משתתפים · {phase === 'waiting' ? '—' : allocatorCount} שלחו</span>
        </div>
        {phase === 'closed' && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setSlide('winners')} aria-pressed={slide === 'winners'} className={slide === 'winners' ? '!bg-ivory !text-velvet-0' : ''}>הזוכים</Button>
            <Button size="sm" onClick={() => setSlide('values')} aria-pressed={slide === 'values'} className={slide === 'values' ? '!bg-ivory !text-velvet-0' : ''}>מה הקבוצה מעריכה</Button>
            <Button size="sm" onClick={() => setReplay(k => k + 1)}>הפעלת החשיפה מחדש</Button>
          </div>
        )}
        {phase === 'closed' && <p className="m-0 text-[12px] text-ivory-mute">למכירה חוזרת יש לאפס את הסשן.</p>}
      </DrawerSection>
      <DrawerSection title="הצטרפות">
        <JoinShare slug={room.slug} />
      </DrawerSection>
      <DrawerSection title="פריטי המכירה">
        <ol className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-ivory-dim">
          {sortedTraits.map((t, i) => (
            <li key={t.id} className="flex items-center gap-2">
              <span className="num w-6 text-ivory-mute">{String(i + 1).padStart(2, '0')}</span>
              <span className="truncate">{t.title}</span>
            </li>
          ))}
        </ol>
      </DrawerSection>
      <DrawerSection title="תרגול ואיפוס">
        <ResetControl roomId={room.id} disabled={loading} onReset={handleAfterReset} onError={text => showMsg('error', text)} />
      </DrawerSection>
    </>
  )

  const subline = (
    <>
      <span className="num">{fmt(room.starting_coins)}</span> {UNIT_LABEL} לכל אחד, <span className="num">{lotCount}</span> פריטים. מה שווה לכם יותר?
    </>
  )

  return (
    <LiveFrame drawer={drawer} drawerOpen={drawerOpen} onDrawerClose={onDrawerClose} message={message} busy={loading}>
      <div className="flex h-full flex-col px-24 pb-14 pt-16">
        <StageMeta
          room={room}
          live={phase === 'open'}
          end={phase === 'closed' ? (
            <div className="flex gap-2 rounded-full border border-velvet-3 bg-velvet-1 p-1" role="tablist" aria-label="שקפי התוצאות">
              {([['winners', 'הזוכים'], ['values', 'מה הקבוצה מעריכה']] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={slide === id}
                  onClick={() => setSlide(id)}
                  className={`rounded-full px-5 py-1.5 text-[22px] font-semibold transition-colors ${slide === id ? 'bg-ivory text-velvet-0' : 'text-ivory-dim hover:text-ivory'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : undefined}
        />

        {phase === 'waiting' && (
          <div className="min-h-0 flex-1 pt-6">
            <LobbyScene
              headline="המכירה נפתחת"
              sub={subline}
              count={people.length}
              countLabel="נכנסו"
              people={wall}
              slug={room.slug}
              note="כשכולם בפנים, פותחים את המכירה. כל הפריטים ייפתחו יחד."
              action={
                <StageButton onClick={handleOpen} disabled={loading || sortedTraits.length === 0}>
                  {loading ? 'פותחים…' : 'פתיחת המכירה'}
                </StageButton>
              }
            />
          </div>
        )}

        {phase === 'open' && (
          <div className="min-h-0 flex-1 pt-6">
            <LobbyScene
              headline="המכירה פתוחה"
              sub={subline}
              count={allocatorCount}
              countLabel={<>מתוך <span className="num">{people.length}</span> שלחו</>}
              people={wall}
              slug={room.slug}
              note="אפשר לסגור גם לפני שכולם שלחו. מי שלא שלח לא נכלל בחישוב."
              action={confirmClose ? (
                <StageConfirm question="לסגור את המכירה? מי שלא שלח לא נכלל." onConfirm={handleClose} onCancel={() => setConfirmClose(false)} busy={loading} />
              ) : (
                <StageButton check onClick={() => setConfirmClose(true)} disabled={loading}>סגירת המכירה</StageButton>
              )}
            />
          </div>
        )}

        {phase === 'closed' && (
          <div className="grid min-h-0 flex-1 grid-rows-[104px_minmax(0,1fr)] gap-y-[22px] pt-[22px]">
            <h1 className="m-0 self-end font-display text-[112px] font-black leading-none tracking-[-.02em] text-ivory">
              {slide === 'winners' ? 'הזוכים' : 'מה הקבוצה מעריכה'}
            </h1>
            {slide === 'winners'
              ? <WinnersBoard results={inOrder} replayKey={replay} />
              : <ValuesSlide ranked={ranked} replayKey={replay} />}
          </div>
        )}
      </div>
    </LiveFrame>
  )
}
