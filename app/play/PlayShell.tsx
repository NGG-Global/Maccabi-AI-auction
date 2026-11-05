'use client'

import Link from 'next/link'
import { Notice } from '@/components/game/ui'

// Pieces shared by the auction and allocation participant screens.

/** The phone frame: the mint board, one column, max 430px, wallet bar on top, content, a sticky footer. */
export function PhoneShell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="bg-dots flex min-h-screen flex-col" dir="rtl">
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col">
        <div className={`flex flex-1 flex-col gap-4 px-[14px] pt-4 ${footer ? 'pb-[230px]' : 'pb-8'}`}>{children}</div>
      </div>
      {footer && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t-[3px] border-ink bg-white/85 pb-[max(22px,env(safe-area-inset-bottom))] pt-[14px] backdrop-blur-[6px]">
          <div className="mx-auto flex w-full max-w-[430px] flex-col gap-3 px-[18px]">{footer}</div>
        </div>
      )}
    </main>
  )
}

export function PlaySkeleton() {
  return (
    <main className="bg-dots flex min-h-screen flex-col" dir="rtl" aria-busy="true" aria-label="טוען">
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col gap-4 px-[14px] pt-4">
        <div className="skeleton h-[92px] w-full rounded-[24px]" />
        <div className="skeleton h-40 w-full rounded-[24px]" />
        <div className="skeleton h-20 w-full rounded-[18px]" />
        <div className="skeleton mt-auto mb-6 h-16 w-full rounded-[22px]" />
      </div>
    </main>
  )
}

export function PlayError({ message }: { message: string }) {
  return (
    <main className="bg-dots flex min-h-screen items-center justify-center px-4" dir="rtl">
      <div className="gm-rise flex w-full max-w-sm flex-col gap-4 rounded-[24px] border-[3px] border-ink bg-card p-6 text-center shadow-piece-md">
        <p className="m-0 text-[26px] font-bold leading-tight text-ink">משהו השתבש</p>
        <Notice tone="error">{message}</Notice>
        <Link href="/" className="text-[15px] font-semibold text-ink-2 underline decoration-ink/30 underline-offset-4 hover:text-ink">
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
        <li key={text} className="flex items-start gap-3 text-[16px] leading-relaxed text-ink-2">
          <span aria-hidden="true" className="num mt-[2px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sun text-[14px] text-ink">{i + 1}</span>
          <span>{text}</span>
        </li>
      ))}
    </ol>
  )
}
