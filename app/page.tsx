import Link from 'next/link'

// Participants arrive through the QR code (/join?room=<slug>); staff through /admin.
export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="glass rounded-3xl p-8 text-center max-w-sm animate-scale-in flex flex-col gap-4">
        <p className="text-5xl">🏷️</p>
        <h1 className="text-2xl font-black text-white">מכירה פומבית — היגדים ניהוליים</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          משתתפים: סרקו את קוד ה-QR שמוצג על המסך כדי להצטרף לחדר.
        </p>
        <Link href="/admin" className="text-amber-400 underline text-sm">כניסת צוות NGG</Link>
      </div>
    </main>
  )
}
