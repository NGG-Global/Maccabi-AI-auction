'use client'

import Link from 'next/link'
import { Notice } from '@/components/evening/ui'

// Pieces shared by the auction and allocation participant screens.

/** The phone frame: one column, max 430px, wallet bar on top, content, a sticky footer. */
export function PhoneShell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-velvet-1" dir="rtl">
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col">
        <div className={`flex flex-1 flex-col gap-4 px-[14px] pt-4 ${footer ? 'pb-[220px]' : 'pb-8'}`}>{children}</div>
      </div>
      {footer && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-velvet-3 bg-velvet-1 pb-[max(22px,env(safe-area-inset-bottom))] pt-[14px]">
          <div className="mx-auto flex w-full max-w-[430px] flex-col gap-3 px-[18px]">{footer}</div>
        </div>
      )}
    </main>
  )
}

export function PlaySkeleton() {
  return (
    <main className="flex min-h-screen flex-col bg-velvet-1" dir="rtl" aria-busy="true" aria-label="טוען">
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col gap-4 px-[14px] pt-4">
        <div className="skeleton h-[88px] w-full rounded-[18px]" />
        <div className="skeleton h-40 w-full rounded-[22px]" />
        <div className="skeleton h-20 w-full rounded-[14px]" />
        <div className="skeleton mt-auto mb-6 h-[66px] w-full rounded-[18px]" />
      </div>
    </main>
  )
}

export function PlayError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-velvet-1 px-4" dir="rtl">
      <div className="ev-rise flex w-full max-w-sm flex-col gap-4 rounded-[22px] border border-velvet-3 bg-velvet-2 p-6 text-center">
        <p className="m-0 font-display text-[28px] font-black leading-tight text-ivory">משהו השתבש</p>
        <Notice tone="error">{message}</Notice>
        <Link href="/" className="text-[15px] font-semibold text-ivory-dim underline decoration-velvet-4 underline-offset-4 hover:text-ivory">
          חזרה לדף הכניסה
        </Link>
      </div>
    </main>
  )
}

/** Shown on the phone when the room's live window is closed. */
export function RoomPausedNotice() {
  return <Notice tone="error">הסשן אינו פעיל כרגע. המתינו שהמנחה יפעיל אותו.</Notice>
}

/** A line of game rules, same language on the join screen and the waiting screens. */
export function RulesList({ rules }: { rules: string[] }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {rules.map((text, i) => (
        <li key={text} className="flex items-start gap-3 text-[16px] leading-relaxed text-ivory-dim">
          <span aria-hidden="true" className="num mt-[2px] w-6 shrink-0 text-[18px] text-ivory-mute">{String(i + 1).padStart(2, '0')}</span>
          <span>{text}</span>
        </li>
      ))}
    </ol>
  )
}
