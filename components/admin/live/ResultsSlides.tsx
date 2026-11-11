'use client'

import { useEffect, useRef, useState } from 'react'
import type { AllocationTraitResult } from '@/lib/game/allocation'
import { fmt } from '@/components/game/units'
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
            <div className="flex h-[116px] shrink-0 flex-col justify-center bg-ink px-5 py-3 text-white">
              <span className="text-[38px] font-semibold leading-[1.06] [text-wrap:balance]">{r.traitTitle}</span>
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
/** Height left for the table rows on the values slide (canvas px). */
const TABLE_ROWS_PX = 376
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
  // Places 4..N share a fixed band of the 1080 canvas (about 376px under the
  // header), so the row height and type shrink with the count and the last
  // row is never cut off. Ten statements give the full 49px rows at 36px.
  const rowH = tableCount > 0 ? Math.min(49, Math.floor(TABLE_ROWS_PX / tableCount)) : 49
  const rowFont = Math.min(36, Math.round(rowH * 0.72))

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
            style={{ height: rowH, fontSize: rowFont }}
            className={`grid shrink-0 grid-cols-[110px_minmax(0,1fr)_360px_320px] items-center transition-[opacity,transform] duration-[450ms] ease-[var(--ease-out-expo)] ${
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

/* ── "סך ההשקעה בכל פריט": every statement as a bar ───────────────── */

interface ChartProps {
  /** Results ranked as lib/game/allocation computes them (highest total first). */
  ranked: AllocationTraitResult[]
  replayKey?: number
}

/** Height of the chart card's plot area on the 1080 canvas. */
const CHART_PX = 700
/** Room kept after the longest bar for its value label, so every bar shares one scale. */
const LABEL_SLOT_PX = 190

/**
 * One horizontal bar per statement, longest first, growing from the start
 * (right) edge. A single measure, so no legend: the slide title names it,
 * and each bar carries its total in ink. Remounts on replay.
 */
export function TotalsChart({ ranked, replayKey = 0 }: ChartProps) {
  return <TotalsBars key={replayKey} ranked={ranked} />
}

function TotalsBars({ ranked }: { ranked: AllocationTraitResult[] }) {
  const reduce = useReducedMotion()
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), reduce ? 0 : 150)
    return () => clearTimeout(t)
  }, [reduce])

  const max = Math.max(1, ...ranked.map(r => r.totalAllocated))
  const n = Math.max(1, ranked.length)
  const rowH = Math.min(72, Math.floor(CHART_PX / n))
  const barH = Math.max(14, Math.round(rowH * 0.62))
  const font = Math.min(34, Math.max(16, Math.round(rowH * 0.48)))

  return (
    <div className="flex min-h-0 flex-col justify-center rounded-[24px] border-4 border-ink bg-card px-10 py-6 shadow-piece-xl" role="table" aria-label="סך ההשקעה בכל פריט">
      {ranked.map((r, i) => {
        const pct = (r.totalAllocated / max) * 100
        return (
          <div key={r.roundId} role="row" className="grid grid-cols-[480px_minmax(0,1fr)] items-center gap-6" style={{ height: rowH, fontSize: font }}>
            <span role="cell" className="truncate font-medium text-ink">{r.traitTitle}</span>
            <span role="cell" className="flex min-w-0 items-center gap-4">
              <span
                aria-hidden="true"
                className={`block shrink-0 rounded-l-[12px] rounded-r-[4px] border-[3px] border-ink shadow-piece-sm transition-[width] duration-[900ms] ease-[var(--ease-out-expo)] ${i === 0 ? 'bg-sun' : 'bg-sun-tint'}`}
                style={{ height: barH, width: grown ? `max(6px, calc((100% - ${LABEL_SLOT_PX}px) * ${pct / 100}))` : 0, transitionDelay: reduce ? '0ms' : `${i * 70}ms` }}
              />
              <span className="num shrink-0 text-ink">{fmt(r.totalAllocated)}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
