import Link from 'next/link'
import CoinIcon from '@/components/evening/CoinIcon'

// Participants arrive through the QR code (/join?room=<slug>); staff through /admin.
export default function Home() {
  return (
    <main className="stage-atmos flex min-h-screen items-center justify-center px-4">
      <div className="ev-rise flex w-full max-w-sm flex-col items-center gap-5 rounded-[22px] border border-velvet-3 bg-velvet-2 p-8 text-center">
        <CoinIcon size={48} />
        <h1 className="m-0 font-display text-[40px] font-black leading-none text-ivory">ערב מכירה</h1>
        <p className="m-0 text-[17px] leading-relaxed text-ivory-dim">
          משתתפים: סורקים את קוד ה־QR שמוצג על המסך כדי להיכנס למכירה.
        </p>
        <Link href="/admin" className="text-[15px] font-semibold text-ivory-dim underline decoration-velvet-4 underline-offset-4 hover:text-ivory">
          כניסת צוות NGG
        </Link>
      </div>
    </main>
  )
}
