'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import RoomBrand from '@/components/shared/RoomBrand'
import type { PublicRoom } from '@/lib/types'

// Pieces shared by the auction and allocation participant screens.

export function PlaySkeleton() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col" dir="rtl">
      <header className="bg-slate-900 border-b border-white/10 px-5 py-4 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-3 w-10 rounded" />
          <div className="skeleton h-5 w-28 rounded" />
        </div>
        <div className="skeleton h-12 w-24 rounded-2xl" />
      </header>
      <div className="flex-1 flex flex-col px-4 py-6 gap-4">
        <div className="skeleton h-40 w-full rounded-3xl" />
        <div className="skeleton h-24 w-full rounded-2xl" />
        <div className="skeleton h-14 w-full rounded-2xl" />
      </div>
    </main>
  )
}

export function PlayError({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="glass rounded-3xl p-8 text-center max-w-sm animate-scale-in">
        <p className="text-4xl mb-4">⚠️</p>
        <p className="text-red-400 text-lg font-semibold">{message}</p>
        <Link href="/" className="block mt-4 text-amber-400 underline text-sm">חזרה לדף הכניסה</Link>
      </div>
    </main>
  )
}

/** Room branding + name + wallet bar; the balance flashes when it changes (e.g. when a round closes). */
export function WalletHeader({ room, name, balance }: { room: PublicRoom; name: string; balance: number }) {
  const prevBalanceRef = useRef<number | null>(null)
  const [walletFlash, setWalletFlash] = useState(false)

  useEffect(() => {
    if (prevBalanceRef.current !== null && balance !== prevBalanceRef.current) {
      setWalletFlash(true)
      const t = setTimeout(() => setWalletFlash(false), 800)
      prevBalanceRef.current = balance
      return () => clearTimeout(t)
    }
    prevBalanceRef.current = balance
  }, [balance])

  return (
    <header className="bg-slate-900 border-b border-white/10 px-5 py-3 flex flex-col gap-3">
      <RoomBrand title={room.title} clientName={room.client_name} logoPath={room.logo_path} size="sm" />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs">שלום,</p>
          <p className="text-white font-bold text-base">{name}</p>
        </div>
        <div className={`text-left rounded-2xl px-4 py-2 border transition-colors duration-300 ${
          walletFlash
            ? 'bg-amber-500/30 border-amber-400/60 animate-wallet-flash'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <p className="text-amber-500/70 text-xs">יתרה</p>
          <p className="text-amber-400 text-2xl font-black tabular-nums">{balance.toLocaleString()} <span className="text-lg">🪙</span></p>
        </div>
      </div>
    </header>
  )
}

/** Shown on the phone when the room's live window is closed. */
export function RoomPausedNotice() {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-center">
      <p className="text-red-300 text-sm font-semibold">החדר אינו פעיל כרגע. המתינו שהמנחה יפעיל אותו.</p>
    </div>
  )
}
