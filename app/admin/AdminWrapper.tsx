'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { Event, AuctionRound, Trait } from '@/lib/types'

const AdminDashboard = dynamic(() => import('./AdminDashboard'), { ssr: false })
const AnalyticsDashboard = dynamic(() => import('./AnalyticsDashboard'), { ssr: false })

interface Props {
  event: Event
  traits: Trait[]
  initialRound: AuctionRound | null
}

type TabId = 'controls' | 'analytics'

interface TabButtonProps {
  id: TabId
  label: string
  active: boolean
  onClick: (id: TabId) => void
}

function TabButton({ id, label, active, onClick }: TabButtonProps) {
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

export default function AdminWrapper(props: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('controls')

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Tab bar */}
      <nav className="flex items-center gap-1 px-4 py-2 bg-slate-900/80 border-b border-white/10 shrink-0">
        <TabButton
          id="controls"
          label="🎛 בקרה"
          active={activeTab === 'controls'}
          onClick={setActiveTab}
        />
        <TabButton
          id="analytics"
          label="📊 תמונת מצב"
          active={activeTab === 'analytics'}
          onClick={setActiveTab}
        />
        <span className="mr-auto text-xs text-slate-600 px-2">{props.event.name}</span>
      </nav>

      <div className={activeTab === 'controls' ? 'contents' : 'hidden'}>
        <AdminDashboard {...props} />
      </div>
      <div className={activeTab === 'analytics' ? 'contents' : 'hidden'}>
        <AnalyticsDashboard event={props.event} />
      </div>
    </div>
  )
}
