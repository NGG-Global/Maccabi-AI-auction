'use client'

import { useState } from 'react'
import ProjectorCanvas from '@/components/evening/ProjectorCanvas'
import { Toast } from '@/components/evening/ui'

export interface LiveMessage { type: 'success' | 'error'; text: string }

interface Props {
  /** The 1920×1080 stage content. */
  children: React.ReactNode
  /** Facilitator controls that must not be projected large: live window, QR, order, reset. */
  drawer: React.ReactNode
  message: LiveMessage | null
  /** A thin loading line above the stage. */
  busy?: boolean
}

/**
 * The projected area: the scaled stage, a small toggle for the facilitator
 * drawer, and the toast. The drawer overlays the stage on the left (RTL
 * end) so the room keeps seeing the sale while the facilitator works.
 */
export default function LiveFrame({ children, drawer, message, busy = false }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-velvet-0">
      <div className={`h-[2px] shrink-0 transition-opacity ${busy ? 'skeleton opacity-100' : 'opacity-0'}`} />
      <div className="relative min-h-0 flex-1">
        <ProjectorCanvas>{children}</ProjectorCanvas>

        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="facilitator-drawer"
          className="absolute bottom-3 left-3 z-30 rounded-full border border-velvet-4 bg-velvet-1/90 px-4 py-2 text-[13px] font-semibold text-ivory-dim backdrop-blur-[12px] transition-colors hover:text-ivory"
        >
          {open ? 'סגירת בקרת המנחה' : 'בקרת המנחה'}
        </button>

        <aside
          id="facilitator-drawer"
          aria-label="בקרת המנחה"
          className={`absolute inset-y-0 left-0 z-20 flex w-[340px] max-w-full flex-col gap-4 overflow-y-auto border-r border-velvet-3 bg-velvet-1/95 p-4 pb-16 shadow-[var(--shadow-menu)] backdrop-blur-[12px] transition-transform duration-300 ease-[var(--ease-out-expo)] ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
          dir="rtl"
        >
          {drawer}
        </aside>
      </div>
      {message && <Toast tone={message.type === 'error' ? 'error' : 'neutral'}>{message.text}</Toast>}
    </div>
  )
}

export function DrawerSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-velvet-3 pb-4 last:border-b-0">
      {title && <p className="m-0 text-[13px] font-semibold text-ivory-mute">{title}</p>}
      {children}
    </section>
  )
}
