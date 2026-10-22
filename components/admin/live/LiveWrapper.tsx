'use client'

import { useState } from 'react'
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

type TabId = 'controls' | 'analytics'

function TabButton({ id, label, active, onClick }: { id: TabId; label: string; active: boolean; onClick: (id: TabId) => void }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`
        px-4 py-2 text-sm font-semibold rounded-lg transition-all relative
        ${active
          ? 'text-white after:absolute after:bottom-0 after:right-0 after:left-0 after:h-0.5 after:bg-amber-400 after:rounded-full'
          : 'text-slate-400 hover:text-slate-200'
        }
      `}
    >
      {label}
    </button>
  )
}

/** The projected screen of one room: facilitator controls + live analytics. */
export default function LiveWrapper({ room, traits, initialRound }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('controls')
  const gameMode = room.game_mode

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <nav className="flex items-center gap-1 px-4 py-2 bg-slate-900/80 border-b border-white/10 shrink-0">
        <TabButton id="controls" label="🎛 בקרה" active={activeTab === 'controls'} onClick={setActiveTab} />
        <TabButton id="analytics" label="📊 תמונת מצב" active={activeTab === 'analytics'} onClick={setActiveTab} />
        <span className="mr-auto text-xs text-slate-600 px-2 truncate">{room.title}</span>
        <Link href={`/admin/rooms/${room.id}`} className="text-xs text-slate-400 hover:text-white px-2">הגדרות</Link>
        <Link href="/admin" className="text-xs text-slate-400 hover:text-white px-2">כל החדרים</Link>
      </nav>

      <div className={activeTab === 'controls' ? 'contents' : 'hidden'}>
        {gameMode === 'allocation' ? (
          <AllocationDashboard room={room} traits={traits} />
        ) : (
          <AuctionDashboard room={room} traits={traits} initialRound={initialRound} />
        )}
      </div>
      <div className={activeTab === 'analytics' ? 'contents' : 'hidden'}>
        <AnalyticsDashboard room={room} gameMode={gameMode} />
      </div>
    </div>
  )
}
