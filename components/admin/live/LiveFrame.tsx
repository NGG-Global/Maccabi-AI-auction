'use client'

import { useEffect } from 'react'
import ProjectorCanvas from '@/components/evening/ProjectorCanvas'
import { Toast } from '@/components/evening/ui'

export interface LiveMessage { type: 'success' | 'error'; text: string }

interface Props {
  /** The 1920×1080 stage content. */
  children: React.ReactNode
  /** Facilitator controls that must not be projected large: live window, QR, order, reset. */
  drawer: React.ReactNode
  drawerOpen: boolean
  onDrawerClose: () => void
  message: LiveMessage | null
  /** A thin loading line above the stage. */
  busy?: boolean
}

/**
 * The projected area: the scaled stage, the facilitator drawer and the
 * toast. The drawer overlays the stage on the left (the RTL end) so the
 * room keeps seeing the sale while the facilitator works.
 *
 * The drawer is mounted only while open and is never moved with a
 * transform: in an RTL document, content pushed past the left edge is
 * scrollable, which shifted the whole screen on tablets. It also carries
 * no backdrop filter, which would trap fixed overlays (the full-screen QR).
 */
export default function LiveFrame({ children, drawer, drawerOpen, onDrawerClose, message, busy = false }: Props) {
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDrawerClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen, onDrawerClose])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-velvet-0">
      <div className={`h-[2px] shrink-0 transition-opacity ${busy ? 'skeleton opacity-100' : 'opacity-0'}`} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ProjectorCanvas>{children}</ProjectorCanvas>

        {drawerOpen && (
          <aside
            id="facilitator-drawer"
            aria-label="בקרת המנחה"
            className="ev-fade absolute inset-y-0 left-0 z-20 flex w-[340px] max-w-full flex-col gap-4 overflow-y-auto border-r border-velvet-3 bg-velvet-1 p-4 shadow-[var(--shadow-menu)]"
            dir="rtl"
          >
            <div className="flex items-center justify-between">
              <p className="m-0 font-display text-[18px] font-bold text-ivory">בקרת המנחה</p>
              <button
                type="button"
                onClick={onDrawerClose}
                className="rounded-full border border-velvet-4 px-3 py-1 text-[13px] font-semibold text-ivory-dim hover:text-ivory"
              >
                סגירה
              </button>
            </div>
            {drawer}
          </aside>
        )}
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
