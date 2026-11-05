'use client'

import { useEffect } from 'react'
import ProjectorCanvas from '@/components/game/ProjectorCanvas'
import { Toast } from '@/components/game/ui'

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
 * room keeps seeing the board while the facilitator works.
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
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-page">
      <div className={`h-[3px] shrink-0 transition-opacity ${busy ? 'skeleton opacity-100' : 'opacity-0'}`} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ProjectorCanvas>{children}</ProjectorCanvas>

        {drawerOpen && (
          <aside
            id="facilitator-drawer"
            aria-label="בקרת המנחה"
            className="gm-fade absolute inset-y-0 left-0 z-20 flex w-[340px] max-w-full flex-col gap-4 overflow-y-auto border-r-[3px] border-ink bg-card p-4"
            dir="rtl"
          >
            <div className="flex items-center justify-between">
              <p className="m-0 text-[18px] font-bold text-ink">בקרת המנחה</p>
              <button
                type="button"
                onClick={onDrawerClose}
                className="press-sm rounded-full border-2 border-ink bg-card px-3 py-1 text-[13px] font-semibold text-ink shadow-piece-xs hover:bg-sun-tint"
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
    <section className="flex flex-col gap-2 border-b-2 border-mint-line pb-4 last:border-b-0">
      {title && <p className="m-0 text-[13px] font-semibold text-ink-3">{title}</p>}
      {children}
    </section>
  )
}
