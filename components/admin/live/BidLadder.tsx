'use client'

import { useLayoutEffect, useRef } from 'react'
import ParticipantMark from '@/components/game/ParticipantMark'
import { fmt } from '@/components/game/units'
import { useReducedMotion } from '@/components/game/useReducedMotion'

export interface LadderBid { key: string; participantId: string; name: string; amount: number }

interface Props {
  bids: LadderBid[]
  /** Scale of the stage, so FLIP deltas measured on screen map back to canvas px. */
  scale?: number
  meId?: string | null
}

/**
 * Inside a white outlined card: the last 6 bids, highest first. The top
 * row is sunflower. Rows that move slide (FLIP) and a new row drops in.
 */
export default function BidLadder({ bids, scale = 1, meId = null }: Props) {
  const listRef = useRef<HTMLOListElement>(null)
  const positions = useRef<Map<string, number>>(new Map())
  const reduce = useReducedMotion()
  const rows = bids.slice(0, 6)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const before = positions.current
    const next = new Map<string, number>()
    for (const li of Array.from(list.children) as HTMLElement[]) {
      const key = li.dataset.k ?? ''
      const top = li.getBoundingClientRect().top
      next.set(key, top)
      if (reduce) continue
      const was = before.get(key)
      if (was === undefined) {
        li.animate([{ transform: 'translateY(-30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' })
      } else if (Math.abs(was - top) > 1) {
        li.animate([{ transform: `translateY(${(was - top) / scale}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' })
      }
    }
    positions.current = next
  }, [rows, scale, reduce])

  return (
    <aside className="flex min-h-0 flex-col gap-[14px] self-start rounded-[32px] border-4 border-ink bg-card px-7 py-[30px] shadow-piece-xl" aria-label="הצעות אחרונות">
      <h3 className="m-0 mb-1.5 text-[34px] font-bold text-ink">הצעות אחרונות</h3>
      {rows.length === 0 ? (
        <p className="m-0 text-[26px] text-ink-3">עדיין אין הצעות. הטלפונים פתוחים.</p>
      ) : (
        <ol ref={listRef} className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((b, i) => {
            const top = i === 0
            const mine = meId !== null && b.participantId === meId
            return (
              <li
                key={b.key}
                data-k={b.key}
                className={`flex h-20 items-center gap-[18px] rounded-[22px] border-[3px] border-ink px-5 ${top ? 'bg-sun' : 'bg-card'}`}
              >
                <ParticipantMark name={b.name} size={56} tone={top ? 'sky' : 'leaf'} />
                <span className="min-w-0 flex-1 truncate text-[28px] font-medium text-ink">
                  {b.name}
                  {mine && <span className="font-semibold text-tomato-text"> · אתם</span>}
                </span>
                <span className="num text-[36px] text-ink">{fmt(b.amount)}</span>
              </li>
            )
          })}
        </ol>
      )}
    </aside>
  )
}
