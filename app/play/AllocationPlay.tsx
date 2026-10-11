'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { AuctionRound, Participant, GameMode } from '@/lib/types'
import {
  checkAllocationDraft,
  draftToPayload,
  parseAllocationInput,
  sortRoundsByTrait,
} from '@/lib/game/allocation'
import { PlaySkeleton, PlayError, WalletHeader } from './PlayShell'

interface Props {
  participantId: string
  eventId: string
  /** Called when the event turns out to be in the other mode (switched by the facilitator). */
  onModeChange: (mode: GameMode) => void
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const STEP = 50
const AUTOSAVE_DELAY_MS = 1200

/**
 * Budget-allocation mode: every trait is open at once and the participant
 * splits their wallet across them. Changes auto-save (and can be saved on
 * demand) until the facilitator closes the allocation. Participants see
 * only their own split; group results appear on the facilitator screen.
 */
export default function AllocationPlay({ participantId, eventId, onModeChange }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [rounds, setRounds] = useState<AuctionRound[]>([])
  const [saved, setSaved] = useState<Record<string, number>>({})
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchSeqRef = useRef(0)
  const draftRef = useRef(draft)
  const dirtyRef = useRef(false)
  const balanceRef = useRef(0)
  const openIdsRef = useRef<string[]>([])
  const savingRef = useRef(false)
  const pendingSaveRef = useRef(false)

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
      supabase.from('participants').select('*').eq('id', participantId).maybeSingle<Participant>(),
      supabase
        .from('auction_rounds')
        .select('*, trait:traits(*)')
        .eq('event_id', eventId)
        .in('status', ['open', 'closed']),
    ])
    if (seq !== fetchSeqRef.current) return
    if (pErr || rErr) {
      setLoadError('שגיאה בטעינת הנתונים. רעננו את הדף.')
      setLoading(false)
      return
    }
    if (!p) {
      setLoadError('המשתתף לא נמצא. סרקו את קוד ה-QR מחדש.')
      setLoading(false)
      return
    }

    const list = sortRoundsByTrait((roundRows ?? []) as AuctionRound[])
    if (list.some(r => r.mode === 'auction')) {
      onModeChange('auction')
      return
    }

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
  }, [supabase, participantId, eventId, onModeChange])

  useEffect(() => {
    fetchState()

    // Throttle: at most one refresh per 300 ms, and a burst cannot postpone it.
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = () => {
      if (refreshTimer) return
      refreshTimer = setTimeout(() => {
        refreshTimer = null
        fetchState()
      }, 300)
    }

    // Only this participant's own rows and the event's rounds — the phone
    // never needs anyone else's allocation.
    const channel = supabase.channel(`play-allocation-${participantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_rounds', filter: `event_id=eq.${eventId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `id=eq.${participantId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids', filter: `participant_id=eq.${participantId}` }, scheduleRefresh)
      .subscribe()
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [supabase, participantId, eventId, fetchState])

  const save = useCallback(async () => {
    // A save requested while one is in flight runs right after it, with the
    // draft as it is then.
    if (savingRef.current) { pendingSaveRef.current = true; return }
    savingRef.current = true
    try {
      do {
        pendingSaveRef.current = false

        // Every open trait is sent (empty = 0): a save replaces the whole split.
        const current: Record<string, string> = {}
        for (const id of openIdsRef.current) current[id] = draftRef.current[id] ?? ''
        if (openIdsRef.current.length === 0 || !checkAllocationDraft(current, balanceRef.current).valid) return

        setSaveState('saving')
        setSaveError(null)
        const payload = draftToPayload(current)
        try {
          const res = await fetch('/api/allocation/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: localStorage.getItem('auction_session_token'), allocations: payload }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            setSaveState('error')
            setSaveError(data.error ?? 'שגיאה בשמירה')
            if (data.code === 'allocation_not_open') fetchState()
            return
          }
          setSaved(Object.fromEntries(Object.entries(payload).filter(([, v]) => v > 0)))
          setSaveState('saved')
        } catch {
          setSaveState('error')
          setSaveError('שגיאת רשת. נסו שוב.')
          return
        }
      } while (pendingSaveRef.current)
    } finally {
      savingRef.current = false
    }
  }, [fetchState])

  // Auto-save shortly after the last change, so nobody loses their split
  // because they forgot to press save before the facilitator closed it.
  useEffect(() => {
    if (phase !== 'open' || !dirty || !check.valid) return
    const t = setTimeout(save, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [phase, dirty, check.valid, draft, save])

  function setAmount(roundId: string, value: string) {
    setDraft(prev => ({ ...prev, [roundId]: value }))
    if (saveState === 'error') setSaveState('idle')
  }

  function step(roundId: string, delta: number) {
    const current = parseAllocationInput(draft[roundId] ?? '') ?? 0
    const capped = delta > 0 ? Math.min(delta, Math.max(0, check.remaining)) : delta
    const next = Math.max(0, current + capped)
    setAmount(roundId, next > 0 ? String(next) : '')
  }

  if (loading) return <PlaySkeleton />
  if (loadError || !participant) return <PlayError message={loadError ?? 'שגיאה לא צפויה'} />

  const totalSaved = Object.values(saved).reduce((s, v) => s + v, 0)
  const wonRounds = rounds.filter(r => r.status === 'closed' && r.winner_participant_id === participant.id)
  const usedPct = balance > 0 ? Math.min(100, Math.round((check.total / balance) * 100)) : 0

  const statusLine =
    !check.valid ? null :
    saveState === 'saving' ? <span className="text-slate-400">שומר…</span> :
    saveState === 'error' ? <span className="text-red-400">{saveError}</span> :
    dirty ? <span className="text-amber-400">שינויים ממתינים לשמירה</span> :
    totalSaved > 0 || saveState === 'saved' ? <span className="text-green-400">✓ החלוקה נשמרה</span> :
    <span className="text-slate-500">עוד לא חילקת מטבעות</span>

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col">
      <WalletHeader name={participant.display_name} balance={participant.wallet_balance} />

      <div className={`flex-1 flex flex-col px-4 py-6 gap-4 ${phase === 'open' ? 'pb-48' : ''}`}>

        {/* Waiting */}
        {phase === 'waiting' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in">
            <div className="text-7xl animate-float">🧩</div>
            <div className="text-center">
              <p className="text-white text-2xl font-black mb-2">ממתינים לפתיחת החלוקה</p>
              <p className="text-slate-500">כל הכישורים ייפתחו יחד</p>
            </div>
            <AllocationRules />
          </div>
        )}

        {/* Open */}
        {phase === 'open' && (
          <div className="flex flex-col gap-4 animate-slide-in-up">
            <div className="bg-gradient-to-br from-blue-950 to-slate-900 rounded-3xl p-5 border border-blue-500/30">
              <span className="text-blue-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-live-dot" />
                החלוקה פתוחה
              </span>
              <h2 className="text-2xl font-black text-white mb-1">
                חלקו {balance.toLocaleString()} מטבעות בין {openRounds.length} הכישורים
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                השינויים נשמרים אוטומטית, ואפשר לשנות עד שהמנחה סוגר את החלוקה. ההקצאה הגבוהה ביותר בכל כישור זוכה בו.
              </p>
            </div>

            {openRounds.map(r => {
              const raw = draft[r.id] ?? ''
              const amount = parseAllocationInput(raw)
              const share = balance > 0 && amount ? Math.min(100, Math.round((amount / balance) * 100)) : 0
              return (
                <div key={r.id} className={`rounded-2xl p-4 border transition-colors ${
                  amount ? 'bg-amber-500/5 border-amber-500/30' : 'bg-slate-900 border-white/10'
                }`}>
                  <p className="text-white font-bold text-lg leading-snug">{r.trait?.title}</p>
                  {r.trait?.description && (
                    <p className="text-slate-500 text-xs leading-relaxed mt-1">{r.trait.description}</p>
                  )}

                  {/* Numbers read left-to-right, so the stepper is LTR inside the RTL page */}
                  <div dir="ltr" className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => step(r.id, -STEP)}
                      disabled={!amount}
                      aria-label={`הורדת ${STEP} מטבעות`}
                      className="w-12 h-12 rounded-xl bg-slate-800 text-white text-2xl font-black disabled:opacity-30 active:scale-95 transition-all shrink-0"
                    >
                      −
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={raw}
                      onChange={e => setAmount(r.id, e.target.value.replace(/[^\d]/g, ''))}
                      placeholder="0"
                      aria-label={`מטבעות עבור ${r.trait?.title ?? ''}`}
                      className="flex-1 min-w-0 h-12 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl px-3 text-2xl font-black text-center text-white focus:outline-none transition-colors placeholder:text-slate-600 tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => step(r.id, STEP)}
                      disabled={check.remaining <= 0}
                      aria-label={`הוספת ${STEP} מטבעות`}
                      className="w-12 h-12 rounded-xl bg-amber-500 text-slate-900 text-2xl font-black disabled:opacity-30 active:scale-95 transition-all shrink-0"
                    >
                      +
                    </button>
                  </div>

                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-3">
                    <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${share}%` }} />
                  </div>
                </div>
              )
            })}

            <p className="text-center text-slate-500 text-xs leading-relaxed px-2">
              בסגירת החלוקה כל המטבעות שהקצית יורדים מהיתרה — גם בכישורים שלא זכית בהם. מטבעות שלא חולקו נשארים אצלך.
            </p>
          </div>
        )}

        {/* Closed */}
        {phase === 'closed' && (
          <div className="flex flex-col gap-4 animate-scale-in">
            <div className={`rounded-3xl p-6 border-2 text-center ${
              wonRounds.length > 0
                ? 'bg-gradient-to-br from-amber-950 to-slate-900 border-amber-400/60 animate-pulse-gold'
                : 'bg-slate-900 border-white/10'
            }`}>
              <p className="text-5xl mb-3">{wonRounds.length > 0 ? '🏆' : '🧩'}</p>
              <p className={`text-2xl font-black mb-1 ${wonRounds.length > 0 ? 'text-amber-400' : 'text-white'}`}>
                {wonRounds.length > 0
                  ? `זכית ב-${wonRounds.length} ${wonRounds.length === 1 ? 'כישור' : 'כישורים'}!`
                  : 'החלוקה נסגרה'}
              </p>
              <p className="text-slate-400 text-sm">
                {totalSaved > 0
                  ? <>הקצית <span className="text-white font-bold">{totalSaved.toLocaleString()} 🪙</span> בסך הכל</>
                  : 'לא הקצית מטבעות בחלוקה זו'}
              </p>
            </div>

            {totalSaved > 0 && (
              <div className="glass rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/10">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">החלוקה שלך</span>
                </div>
                {rounds.map(r => {
                  const mine = saved[r.id] ?? 0
                  const won = r.winner_participant_id === participant.id
                  return (
                    <div key={r.id} className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 ${won ? 'bg-amber-500/10' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold truncate ${won ? 'text-amber-300' : mine ? 'text-white' : 'text-slate-500'}`}>
                          {won && '🏆 '}{r.trait?.title}
                        </p>
                        {!won && r.winning_bid_amount !== null && (
                          <p className="text-slate-500 text-xs">ההקצאה הזוכה: {r.winning_bid_amount.toLocaleString()} 🪙</p>
                        )}
                      </div>
                      <span className={`font-black tabular-nums shrink-0 ${won ? 'text-amber-400' : mine ? 'text-slate-200' : 'text-slate-600'}`}>
                        {mine.toLocaleString()} 🪙
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-center text-slate-600 text-xs">
              <a href="/profile" className="underline hover:text-slate-400 transition-colors">צפה בפרופיל שלך</a>
            </p>
          </div>
        )}
      </div>

      {/* Sticky budget bar while the allocation is open */}
      {phase === 'open' && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-white/10 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-md mx-auto flex flex-col gap-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-300">
                חולקו <span className="text-white font-black tabular-nums">{check.total.toLocaleString()}</span> מתוך {balance.toLocaleString()}
              </span>
              <span className={`font-bold tabular-nums ${check.remaining < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                {check.remaining < 0 ? 'חריגה' : `נותרו ${check.remaining.toLocaleString()}`}
              </span>
            </div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${check.valid ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${check.valid ? usedPct : 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs min-h-4">
                {check.error ? <span className="text-red-400">{check.error}</span> : statusLine}
              </p>
              <button
                type="button"
                onClick={save}
                disabled={!dirty || !check.valid || saveState === 'saving'}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-slate-900 rounded-xl px-5 py-2.5 text-sm font-black transition-all active:scale-95 shrink-0"
              >
                {saveState === 'saving' ? '...' : 'שמירה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function AllocationRules() {
  return (
    <div className="glass rounded-3xl p-5 w-full max-w-sm">
      <div className="flex flex-col gap-3">
        {[
          { icon: '🪙', text: 'לכל משתתף 1,000 מטבעות' },
          { icon: '🧩', text: 'כל הכישורים פתוחים יחד — מחלקים את המטבעות ביניהם' },
          { icon: '✏️', text: 'אפשר לשנות את החלוקה עד שהמנחה סוגר אותה' },
          { icon: '🏆', text: 'ההקצאה הגבוהה ביותר בכל כישור זוכה בו' },
        ].map(r => (
          <div key={r.icon} className="flex items-start gap-3">
            <span className="text-xl shrink-0">{r.icon}</span>
            <p className="text-slate-300 text-sm leading-relaxed">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
