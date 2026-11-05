'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { Room, AuctionRound, Trait } from '@/lib/types'

const AuctionDashboard = dynamic(() => import('./AuctionDashboard'), { ssr: false })
const AllocationDashboard = dynamic(() => import('./AllocationDashboard'), { ssr: false })
const AnalyticsDashboard = dynamic(() => import('./AnalyticsDashboard'), { ssr: false })

interface Props {
  room: Room
  traits: Trait[]
  initialRound: AuctionRound | null
}

/** What the two dashboards receive from the shell. */
export interface LiveShellProps {
  drawerOpen: boolean
  onDrawerClose: () => void
}

type TabId = 'controls' | 'analytics'

function TabButton({ id, label, active, onClick }: { id: TabId; label: string; active: boolean; onClick: (id: TabId) => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onClick(id)}
      className={`rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors ${
        active ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}

/** The projected screen of one room: the stage, plus the facilitator's analytics view. */
export default function LiveWrapper({ room, traits, initialRound }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('controls')
  // The analytics view keeps its own subscriptions and queries; it is
  // mounted the first time the facilitator opens it and stays mounted after.
  const [analyticsMounted, setAnalyticsMounted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const gameMode = room.game_mode

  function selectTab(id: TabId) {
    if (id === 'analytics') setAnalyticsMounted(true)
    setActiveTab(id)
  }

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-page" dir="rtl">
      <nav className="flex h-12 shrink-0 items-center gap-2 border-b-2 border-ink bg-card px-3" aria-label="מסך המנחה">
        <span className="ml-2 text-[18px] font-bold text-ink">המכירה הפומבית</span>
        <div className="flex gap-1 rounded-full border-2 border-ink bg-card p-0.5" role="tablist">
          <TabButton id="controls" label="המופע בחדר" active={activeTab === 'controls'} onClick={selectTab} />
          <TabButton id="analytics" label="תמונת מצב" active={activeTab === 'analytics'} onClick={selectTab} />
        </div>
        <span className="mr-auto truncate px-2 text-[13px] text-ink-3">{room.title}</span>
        {activeTab === 'controls' && (
          <button
            type="button"
            onClick={() => setDrawerOpen(o => !o)}
            aria-expanded={drawerOpen}
            aria-controls="facilitator-drawer"
            className={`rounded-full border-2 px-3 py-1 text-[13px] font-semibold transition-colors ${drawerOpen ? 'border-ink bg-ink text-white' : 'border-ink bg-card text-ink hover:bg-sun-tint'}`}
          >
            בקרת המנחה
          </button>
        )}
        <button type="button" onClick={toggleFullscreen} className="rounded-full border-2 border-ink bg-card px-3 py-1 text-[13px] font-semibold text-ink hover:bg-sun-tint">
          {fullscreen ? 'יציאה ממסך מלא' : 'מסך מלא'}
        </button>
        <Link href={`/admin/rooms/${room.id}`} className="px-2 text-[13px] font-semibold text-ink-2 hover:text-ink">הגדרות</Link>
        <Link href="/admin" className="px-2 text-[13px] font-semibold text-ink-2 hover:text-ink">הסשנים</Link>
      </nav>

      <div className={activeTab === 'controls' ? 'contents' : 'hidden'}>
        {gameMode === 'allocation' ? (
          <AllocationDashboard room={room} traits={traits} drawerOpen={drawerOpen} onDrawerClose={closeDrawer} />
        ) : (
          <AuctionDashboard room={room} traits={traits} initialRound={initialRound} drawerOpen={drawerOpen} onDrawerClose={closeDrawer} />
        )}
      </div>
      <div className={activeTab === 'analytics' ? 'contents' : 'hidden'}>
        {analyticsMounted && <AnalyticsDashboard room={room} gameMode={gameMode} />}
      </div>
    </div>
  )
}
