'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { DB_SCHEMA } from '@/lib/supabase/schema'
import type { AuctionRound, Participant, PublicRoom } from '@/lib/types'
import { EMBED } from '@/lib/supabase/embeds'
import {
  checkAllocationDraft,
  draftToPayload,
  parseAllocationInput,
  sortRoundsByTrait,
  isRoundWinner,
  roundWinnerNames,
} from '@/lib/game/allocation'
import { PlaySkeleton, PlayError, PhoneShell, RulesList } from './PlayShell'
import WalletBar from '@/components/game/WalletBar'
import Stepper from '@/components/game/Stepper'
import CoinIcon from '@/components/game/CoinIcon'
import ParticipantMark from '@/components/game/ParticipantMark'
import { CTA, btnClass } from '@/components/game/ui'
import { UNIT_LABEL, defaultBidStep, fmt, lotNo } from '@/components/game/units'

interface Props {
  room: PublicRoom
  participantId: string
  sessionToken: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const AUTOSAVE_DELAY_MS = 1200

/**
 * Budget-allocation mode: every trait is open at once and the participant
 * splits their wallet across them. Changes auto-save (and can be sent on
 * demand) until the facilitator closes the allocation. Participants see
 * only their own split; group results appear on the facilitator screen.
 */
export default function AllocationPlay({ room, participantId, sessionToken }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [rounds, setRounds] = useState<AuctionRound[]>([])
  const [saved, setSaved] = useState<Record<string, number>>({})
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  // After "שליחת ההצעות" the phone shows the sent screen until the next edit.
  const [sentView, setSentView] = useState(false)

  const fetchSeqRef = useRef(0)
  const draftRef = useRef(draft)
  const dirtyRef = useRef(false)
  const balanceRef = useRef(0)
  const openIdsRef = useRef<string[]>([])
  const savingRef = useRef(false)
  const pendingSaveRef = useRef(false)

  const STEP = room.bid_step ?? defaultBidStep('allocation', room.starting_coins)
  const openRounds = useMemo(() => rounds.filter(r => r.status === 'open'), [rounds])
  const phase: 'waiting' | 'open' | 'closed' =
    openRounds.length > 0 ? 'open' : rounds.length > 0 ? 'closed' : 'waiting'
  const balance = participant?.wallet_balance ?? 0

  const dirty = useMemo(
    () => openRounds.some(r => (parseAllocationInput(draft[r.id] ?? '') ?? -1) !== (saved[r.id] ?? 0)),
    [openRounds, draft, saved],
  )
  const check = useMemo(() => {
    const scoped: Record<string, string> = {}
    for (const r of openRounds) scoped[r.id] = draft[r.id] ?? ''
    return checkAllocationDraft(scoped, balance)
  }, [openRounds, draft, balance])

  useEffect(() => { draftRef.current = draft }, [draft])
  useEffect(() => { dirtyRef.current = dirty }, [dirty])
  useEffect(() => { balanceRef.current = balance }, [balance])
  useEffect(() => { openIdsRef.current = openRounds.map(r => r.id) }, [openRounds])

  const fetchState = useCallback(async () => {
    // Responses can arrive out of order under load; only the latest call may write state.
    const seq = ++fetchSeqRef.current

    const [{ data: p, error: pErr }, { data: roundRows, error: rErr }] = await Promise.all([
      supabase.from('participants').select('*').eq('id', participantId).eq('room_id', room.id).maybeSingle<Participant>(),
      supabase
        .from('auction_rounds')
        .select(`*, ${EMBED.roundTrait}, ${EMBED.roundWinners}`)
        .eq('room_id', room.id)
        .in('status', ['open', 'closed']),
    ])
    if (seq !== fetchSeqRef.current) return
    if (pErr || rErr) {
      setLoadError('שגיאה בטעינת הנתונים. רעננו את הדף.')
      setLoading(false)
      return
    }
    if (!p) {
      setLoadError('המשתתף לא נמצא (ייתכן שהסשן אופס). סרקו את קוד ה־QR והירשמו מחדש.')
      setLoading(false)
      return
    }

    const list = sortRoundsByTrait((roundRows ?? []) as AuctionRound[])

    let mine: Record<string, number> = {}
    if (list.length > 0) {
      const { data: bids } = await supabase
        .from('bids')
        .select('round_id, amount')
        .eq('participant_id', participantId)
        .in('round_id', list.map(r => r.id))
      if (seq !== fetchSeqRef.current) return
      mine = Object.fromEntries((bids ?? []).map(b => [b.round_id as string, b.amount as number]))
    }

    setParticipant(p)
    setRounds(list)
    setSaved(mine)
    setLoadError(null)
    setLoading(false)

    // Never overwrite edits the participant has not saved yet.
    if (!dirtyRef.current) {
      const next: Record<string, string> = {}
      for (const r of list) if (r.status === 'open') next[r.id] = mine[r.id] ? String(mine[r.id]) : ''
      setDraft(next)
    }
  }, [supabase, participantId, room.id])

  useEffect(() => {
    // Deferred a tick so the first load never sets state inside the effect itself.
    const first = setTimeout(() => fetchState(), 0)

    // Throttle: at most one refresh per 300 ms, and a burst cannot postpone it.
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = () => {
      if (refreshTimer) return
      refreshTimer = setTimeout(() => {
        refreshTimer = null
        fetchState()
      }, 300)
    }

    // Only this participant's own rows and the room's rounds — the phone
    // never needs anyone else's allocation.
    const channel = supabase.channel(`play-allocation-${participantId}`)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'auction_rounds', filter: `room_id=eq.${room.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'participants', filter: `id=eq.${participantId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: DB_SCHEMA, table: 'bids', filter: `participant_id=eq.${participantId}` }, scheduleRefresh)
      .subscribe()
    return () => {
      clearTimeout(first)
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [supabase, participantId, room.id, fetchState])

  const save = useCallback(async (): Promise<boolean> => {
    // A save requested while one is in flight runs right after it, with the
    // draft as it is then.
    if (savingRef.current) { pendingSaveRef.current = true; return false }
    savingRef.current = true
    let ok = false
    try {
      do {
        pendingSaveRef.current = false

        // Every open trait is sent (empty = 0): a save replaces the whole split.
        const current: Record<string, string> = {}
        for (const id of openIdsRef.current) current[id] = draftRef.current[id] ?? ''
        if (openIdsRef.current.length === 0 || !checkAllocationDraft(current, balanceRef.current).valid) return false

        setSaveState('saving')
        setSaveError(null)
        const payload = draftToPayload(current)
        try {
          const res = await fetch('/api/allocation/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken, roomId: room.id, allocations: payload }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            setSaveState('error')
            setSaveError(data.error ?? 'שגיאה בשליחה')
            if (data.code === 'allocation_not_open') fetchState()
            return false
          }
          setSaved(Object.fromEntries(Object.entries(payload).filter(([, v]) => v > 0)))
          setSaveState('saved')
          ok = true
        } catch {
          setSaveState('error')
          setSaveError('שגיאת רשת. נסו שוב.')
          return false
        }
      } while (pendingSaveRef.current)
    } finally {
      savingRef.current = false
    }
    return ok
  }, [fetchState, sessionToken, room.id])

  // Auto-save shortly after the last change, so nobody loses their split
  // because they forgot to press send before the facilitator closed it.
  useEffect(() => {
    if (phase !== 'open' || !dirty || !check.valid) return
    const t = setTimeout(save, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [phase, dirty, check.valid, draft, save])

  function setAmount(roundId: string, value: string) {
    setDraft(prev => ({ ...prev, [roundId]: value }))
    setSentView(false)
    if (saveState === 'error') setSaveState('idle')
  }

  function step(roundId: string, delta: number) {
    const current = parseAllocationInput(draft[roundId] ?? '') ?? 0
    const capped = delta > 0 ? Math.min(delta, Math.max(0, check.remaining)) : delta
    const next = Math.max(0, current + capped)
    setAmount(roundId, next > 0 ? String(next) : '')
  }

  async function send() {
    const ok = await save()
    if (ok) {
      setSentView(true)
      if (navigator.vibrate) navigator.vibrate(20)
    }
  }

  if (loading) return <PlaySkeleton />
  if (loadError || !participant) return <PlayError message={loadError ?? 'שגיאה לא צפויה'} />

  const totalSaved = Object.values(saved).reduce((s, v) => s + v, 0)
  const usedCount = Object.values(saved).filter(v => v > 0).length
  const wonRounds = rounds.filter(r => r.status === 'closed' && isRoundWinner(r, participant.id))
  const lostRounds = rounds.filter(r => r.status === 'closed' && !isRoundWinner(r, participant.id) && (saved[r.id] ?? 0) > 0)
  const remainingLive = phase === 'open' ? Math.max(0, check.remaining) : balance

  const statusLine =
    check.error ? <span className="font-semibold text-error">{check.error}</span>
    : saveState === 'saving' ? <span className="text-ink-3">שולחים…</span>
    : saveState === 'error' ? <span className="font-semibold text-error">{saveError}</span>
    : dirty ? <span className="font-semibold text-tomato-text">השינויים יישלחו אוטומטית בעוד רגע</span>
    : totalSaved > 0 ? <span className="text-ink-3">ההצעות נשמרו. אפשר לשנות עד הסגירה.</span>
    : <span className="text-ink-3">מחלקים את התקציב בין הפריטים ושולחים.</span>

  const footer = phase === 'open' && !sentView ? (
    <>
      <p className="m-0 min-h-[20px] text-center text-[14px]">{statusLine}</p>
      <button
        type="button"
        onClick={send}
        disabled={!check.valid || check.total === 0 || saveState === 'saving'}
        className={CTA}
      >
        {saveState === 'saving' ? 'שולחים…' : check.total === 0 ? `חלקו לפחות ${fmt(STEP)}` : 'שליחת ההצעות'}
      </button>
    </>
  ) : undefined

  return (
    <PhoneShell footer={footer}>
      {phase === 'closed' ? (
        <div className="flex items-center justify-between px-2 pt-2">
          <span className="inline-flex items-center gap-2 text-[17px] font-semibold text-ink">
            <ParticipantMark name={participant.display_name} size={30} tone="ink" />
            {participant.display_name}
          </span>
          <span className="text-[14px] text-ink-3">המכירה נסגרה</span>
        </div>
      ) : (
        <WalletBar
          remaining={remainingLive}
          total={room.starting_coins}
          unitLabel={UNIT_LABEL}
          label="נשארו לך לחלק"
          name={participant.display_name}
        />
      )}

      {/* Waiting */}
      {phase === 'waiting' && (
        <div className="gm-fade flex flex-1 flex-col justify-center gap-6 py-6">
          <div className="text-center">
            <p className="m-0 text-[34px] font-bold leading-tight text-ink">ממתינים לפתיחת המכירה</p>
            <p className="mt-2 mb-0 text-[17px] text-ink-2">כל הפריטים ייפתחו יחד</p>
          </div>
          <div className="rounded-[24px] border-[3px] border-ink bg-card px-5 py-5 shadow-piece-md">
            <RulesList rules={[
              `לכל משתתף ${fmt(room.starting_coins)} ${UNIT_LABEL}.`,
              'כל הפריטים פתוחים יחד. מחלקים את התקציב ביניהם.',
              'אפשר לשנות את ההצעות עד שהמנחה סוגר את המכירה.',
              'ההקצאה הגבוהה בכל פריט זוכה בו. בשוויון כל המובילים זוכים יחד.',
            ]} />
          </div>
        </div>
      )}

      {/* Open: the list of lots with steppers */}
      {phase === 'open' && !sentView && (
        <div className="gm-rise flex flex-col gap-2.5">
          {openRounds.map((r, i) => {
            const raw = draft[r.id] ?? ''
            const amount = parseAllocationInput(raw) ?? 0
            const has = amount > 0
            const title = r.trait?.title ?? ''
            return (
              <div
                key={r.id}
                className={`flex items-center gap-[10px] rounded-[18px] border-[2.5px] border-ink px-3 py-[10px] transition-[background] duration-300 ${
                  has ? 'bg-sun-tint' : 'bg-card'
                }`}
              >
                <span aria-hidden="true" className="num w-[26px] shrink-0 text-[17px] text-ink-3">{lotNo(i + 1)}</span>
                <span className="min-w-0 flex-1 text-[19px] font-medium leading-[1.2] text-ink">{title}</span>
                <Stepper
                  size="sm"
                  coin={false}
                  value={amount}
                  inputValue={raw ? fmt(amount) : ''}
                  onInput={v => setAmount(r.id, v)}
                  inputLabel={`${UNIT_LABEL} עבור ${title}`}
                  onDown={() => step(r.id, -STEP)}
                  onUp={() => step(r.id, STEP)}
                  downDisabled={!has}
                  upDisabled={check.remaining < STEP}
                  downLabel={`הורדת ${fmt(STEP)} ${UNIT_LABEL} מ${title}`}
                  upLabel={`הוספת ${fmt(STEP)} ${UNIT_LABEL} ל${title}`}
                  className="w-[190px] shrink-0"
                />
              </div>
            )
          })}
          <p className="m-0 px-2 pt-2 text-center text-[14px] leading-relaxed text-ink-3">
            בסגירה כל מה שהקציתם יורד מהיתרה, גם בפריטים שלא זכיתם בהם. מה שלא חולק נשאר אצלכם.
          </p>
        </div>
      )}

      {/* Open: sent */}
      {phase === 'open' && sentView && (
        <div className="gm-fade flex flex-1 flex-col items-center justify-center gap-0 px-6 py-6 text-center">
          <span className="gm-pop relative inline-block" aria-hidden="true">
            <CoinIcon stack size={132} />
            <span className="absolute -bottom-1 -left-1.5 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-ink bg-leaf text-ink">
              <svg viewBox="0 0 24 24" fill="none" className="h-[26px] w-[26px]"><path d="M6 12.5l4 4 8-9" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </span>
          <h4 className="mt-8 mb-2 text-[38px] font-bold leading-none text-ink">ההצעות נשלחו</h4>
          <p className="m-0 text-[20px] leading-[1.45] text-ink-2">
            חילקת <span className="num">{fmt(totalSaved)}</span> בין {usedCount} {usedCount === 1 ? 'פריט' : 'פריטים'}.
          </p>
          <p className="mt-[14px] mb-0 text-[15px] text-ink-3">התוצאה תופיע כאן כשהמנחה תסגור את המכירה.</p>
          <button type="button" onClick={() => setSentView(false)} className={btnClass('secondary', 'md', 'mt-8 h-14 px-8 text-[17px]')}>
            שינוי ההצעות
          </button>
        </div>
      )}

      {/* Closed: the personal result */}
      {phase === 'closed' && (
        <div className="gm-rise flex flex-1 flex-col gap-[14px]">
          <h2 className="m-0 mx-1 text-[38px] font-bold leading-[1.05] text-ink">
            {wonRounds.length > 0
              ? <>זכית ב־<span className="num">{wonRounds.length}</span> {wonRounds.length === 1 ? 'פריט' : 'פריטים'}</>
              : 'המכירה נסגרה'}
          </h2>

          {wonRounds.length > 0 ? (
            <div className="flex flex-col gap-[14px] py-1">
              {wonRounds.map(r => {
                const others = roundWinnerNames(r).filter(n => n !== participant.display_name)
                const idx = rounds.findIndex(x => x.id === r.id) + 1
                return (
                  <div key={r.id} className="overflow-hidden rounded-[18px] border-[3px] border-ink bg-card text-ink shadow-piece-md">
                    <div className="flex items-center justify-between bg-ink px-[18px] py-[14px] text-white">
                      <b className="text-[24px] font-semibold leading-tight">{r.trait?.title}</b>
                      <span className="text-[17px] font-semibold text-ink-soft">פריט {lotNo(idx)}</span>
                    </div>
                    <div className="h-[6px] bg-sun" />
                    <div className="flex items-center justify-between px-[18px] pb-4 pt-3 text-[17px] text-ink-3">
                      <span>{others.length > 0 ? `זכייה משותפת עם ${others.join(', ')}` : 'ההקצאה שלך'}</span>
                      <b className="num text-[30px] text-ink">{fmt(saved[r.id] ?? r.winning_bid_amount ?? 0)}</b>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="m-0 mx-1 text-[19px] leading-[1.45] text-ink-2">
              {totalSaved > 0
                ? 'הפעם ההקצאות שלך לא היו הגבוהות ביותר. המטבעות שהקצית ירדו מהיתרה.'
                : 'לא הקצית מטבעות במכירה הזאת, והיתרה נשארה מלאה.'}
            </p>
          )}

          {lostRounds.length > 0 && (
            <details className="mx-1 text-[15px] text-ink-3">
              <summary className="cursor-pointer select-none py-1">הצעות שלא זכו ({lostRounds.length})</summary>
              <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                {lostRounds.map(r => (
                  <li key={r.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-ink-2">{r.trait?.title}</span>
                    <span className="num shrink-0 text-[17px] text-ink-2">{fmt(saved[r.id] ?? 0)}</span>
                    {r.winning_bid_amount !== null && (
                      <span className="shrink-0 text-[13px]">הזוכה: <span className="num">{fmt(r.winning_bid_amount)}</span></span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <WalletBar
            variant="tint"
            remaining={balance}
            total={room.starting_coins}
            unitLabel={UNIT_LABEL}
            label="נשאר לך"
            className="mt-auto"
          />
          <p className="m-0 text-center text-[14px]">
            <a href={`/profile?room=${encodeURIComponent(room.slug)}`} className="text-ink-3 underline decoration-ink/30 underline-offset-4 transition-colors hover:text-ink">
              הפרופיל האישי שלכם
            </a>
          </p>
        </div>
      )}
    </PhoneShell>
  )
}
