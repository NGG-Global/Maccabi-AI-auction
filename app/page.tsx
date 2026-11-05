import Link from 'next/link'
import CoinIcon from '@/components/game/CoinIcon'

// Participants arrive through the QR code (/join?room=<slug>); staff through /admin.
export default function Home() {
  return (
    <main className="bg-dots relative flex min-h-screen items-center justify-center px-4">
      <div className="gm-rise flex w-full max-w-sm flex-col items-center gap-5 rounded-[24px] border-[3px] border-ink bg-card p-8 text-center shadow-piece-md">
        <CoinIcon size={48} />
        <h1 className="m-0 text-[36px] font-bold leading-none text-ink">המכירה הפומבית</h1>
        <p className="m-0 text-[17px] leading-relaxed text-ink-2">
          משתתפים: סורקים את קוד ה־QR שמוצג על המסך כדי להיכנס למכירה.
        </p>
        <Link href="/admin" className="text-[15px] font-semibold text-ink-2 underline decoration-ink/30 underline-offset-4 hover:text-ink">
          כניסת צוות NGG
        </Link>
      </div>
    </main>
  )
}
