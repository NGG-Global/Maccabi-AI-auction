'use client'

import { useEffect, useRef, useState } from 'react'
import type { AllocationTraitResult } from '@/lib/game/allocation'
import { fmt, lotNo } from '@/components/game/units'
import { useReducedMotion } from '@/components/game/useReducedMotion'

/* ── "הזוכים": version A prize board ───────────────────────────────── */

interface WinnersProps {
  /** Results in the fixed statement order. */
  results: AllocationTraitResult[]
  /** Change to replay the flip-in. */
  replayKey?: number
}

export function WinnersBoard({ results, replayKey = 0 }: WinnersProps) {
  const cols = 5
  const rows = Math.max(1, Math.ceil(results.length / cols))
  return (
    <div
      key={replayKey}
      className="grid min-h-0 gap-[22px] pb-2 pl-2 [perspective:1600px]"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {results.map((r, i) => {
        const names = r.winnerNames
        const shown = names.length > 3 ? [...names.slice(0, 3), `ועוד ${names.length - 3}`] : names
        const unsold = names.length === 0
        return (
          <article
            key={r.roundId}
            className="gm-flip flex min-h-0 flex-col overflow-hidden rounded-[26px] border-4 border-ink bg-card text-ink shadow-piece-xl [backface-visibility:hidden]"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="flex h-[116px] shrink-0 flex-col justify-between bg-ink px-5 pb-3 pt-2.5 text-white">
              <span className="num self-start text-[24px] text-ink-soft">{lotNo(i + 1)}</span>
              <span className="text-[38px] font-semibold leading-[1.06]">{r.traitTitle}</span>
            </div>
            <div className="h-[10px] shrink-0 border-b-4 border-ink bg-sun" />
            <div className="flex min-h-0 flex-1 flex-col px-5 pt-2">
              {unsold ? (
                <span className="text-[44px] font-bold leading-none text-ink-3">לא נמכרה</span>
              ) : (
                shown.map(n => <span key={n} className="text-[44px] font-bold leading-none">{n}</span>)
              )}
            </div>
            {!unsold && r.winningAmount !== null && (
              <span className="num mx-5 mb-[14px] mt-1 self-start rounded-[14px] border-[3px] border-ink bg-sun px-4 pb-1 pt-0.5 text-[36px] text-ink">
                {fmt(r.winningAmount)}
              </span>
            )}
          </article>
        )
      })}
    </div>
  )
}

/* ── "מה הקבוצה מעריכה": version A podium + table ──────────────────── */

function CountUp({ to, ms, run }: { to: number; ms: number; run: boolean }) {
  const reduce = useReducedMotion()
  const [animated, setAnimated] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (!run || reduce) return
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      const e = 1 - Math.pow(1 - k, 4)
      setAnimated(k < 1 ? Math.round((to * e) / 10) * 10 : to)
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [to, ms, run, reduce])
  const shown = !run ? 0 : reduce ? to : animated
  return <span className="num">{fmt(shown)}</span>
}

interface ValuesProps {
  /** Results ranked as lib/game/allocation computes them (highest total first). */
  ranked: AllocationTraitResult[]
  replayKey?: number
}

const BAR_H: Record<number, number> = { 1: 196, 2: 140, 3: 96 }
const BAR_CLASS: Record<number, string> = { 1: 'bg-sun', 2: 'bg-sky', 3: 'bg-lilac' }

/** Remounts on every replay, so the reveal always starts from an empty stage. */
export function ValuesSlide({ ranked, replayKey = 0 }: ValuesProps) {
  return <ValuesReveal key={replayKey} ranked={ranked} />
}

function ValuesReveal({ ranked }: { ranked: AllocationTraitResult[] }) {
  const reduce = useReducedMotion()
  // Reveal: bars 3, 2, 1 grow 1100ms apart, each info fades after its bar, then the table rows.
  const [stage, setStage] = useState({ bars: new Set<number>(), info: new Set<number>(), rows: 0 })
  const tableRows = ranked.slice(3)
  const tableCount = tableRows.length

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, reduce ? 0 : ms))
    ;[3, 2, 1].forEach((r, k) => {
      later(() => {
        setStage(s => ({ ...s, bars: new Set([...s.bars, r]) }))
        later(() => setStage(s => ({ ...s, info: new Set([...s.info, r]) })), 420)
      }, 300 + k * 1100)
    })
    later(() => {
      for (let i = 0; i < tableCount; i++) later(() => setStage(s => ({ ...s, rows: Math.max(s.rows, i + 1) })), i * 70)
    }, 3900)
    return () => timers.forEach(clearTimeout)
  }, [reduce, tableCount])

  const place = (r: number) => ranked[r - 1]

  return (
    <div className="grid min-h-0 grid-rows-[372px_minmax(0,1fr)] gap-[12px]">
      <div className="flex h-[372px] items-end justify-center gap-7 border-b-[5px] border-ink">
        {[2, 1, 3].map(r => {
          const item = place(r)
          if (!item) return <div key={r} className="w-[470px]" />
          const grown = stage.bars.has(r)
          const shown = stage.info.has(r)
          return (
            <div key={r} className="flex w-[470px] flex-col items-center gap-[14px]">
              <div
                className={`flex flex-col items-center gap-0.5 text-center transition-[opacity,transform] duration-500 ease-[var(--ease-out-expo)] ${shown ? 'opacity-100' : 'translate-y-4 opacity-0'}`}
                aria-hidden={!shown}
              >
                <span className="text-[40px] font-semibold leading-[1.1] text-ink">{item.traitTitle}</span>
                <span className={`text-[52px] font-bold leading-[1.1] ${r === 1 ? 'text-[#c24a2c]' : 'text-ink'}`}>
                  <CountUp to={item.totalAllocated} ms={900} run={shown} />
                </span>
                <span className="text-[28px] text-ink-2">
                  <span className="num">{item.supporterCount}</span> {item.supporterCount === 1 ? 'משקיע' : 'משקיעים'}
                </span>
              </div>
              <div
                className={`flex self-stretch justify-center overflow-hidden rounded-t-[24px] border-[5px] border-b-0 border-ink pt-4 text-[84px] font-bold leading-none text-ink transition-[height] duration-[900ms] ease-[var(--ease-out-expo)] ${BAR_CLASS[r]}`}
                style={{ height: grown ? BAR_H[r] : 0 }}
              >
                <span className="num">{r}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border-4 border-ink bg-card shadow-piece-xl" role="table" aria-label="מקומות 4 ואילך">
        <div className="grid h-11 grid-cols-[110px_minmax(0,1fr)_360px_320px] items-center border-b-[3px] border-ink text-[24px] font-semibold text-ink-3" role="row">
          <span className="px-6" role="columnheader">#</span>
          <span className="px-6" role="columnheader">פריט</span>
          <span className="px-6" role="columnheader">סה״כ השקעה</span>
          <span className="px-6" role="columnheader">מספר משקיעים</span>
        </div>
        {tableRows.map((item, i) => (
          <div
            key={item.roundId}
            role="row"
            className={`grid h-[49px] grid-cols-[110px_minmax(0,1fr)_360px_320px] items-center text-[36px] transition-[opacity,transform] duration-[450ms] ease-[var(--ease-out-expo)] ${
              i % 2 === 0 ? 'bg-zebra' : ''
            } ${stage.rows > i ? 'opacity-100' : 'translate-y-2.5 opacity-0'}`}
          >
            <span className="px-6 text-ink-3" role="cell"><span className="num">{i + 4}</span></span>
            <span className="truncate px-6 font-medium text-ink" role="cell">{item.traitTitle}</span>
            <span className="px-6 text-ink" role="cell"><span className="num">{fmt(item.totalAllocated)}</span></span>
            <span className="px-6 text-ink" role="cell"><span className="num">{item.supporterCount}</span></span>
          </div>
        ))}
      </div>
    </div>
  )
}
