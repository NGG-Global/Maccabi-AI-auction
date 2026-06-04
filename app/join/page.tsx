import JoinWrapper from './JoinWrapper'
import type { Event } from '@/lib/types'

interface Props {
  searchParams: Promise<{ event?: string }>
}

export default async function JoinPage({ searchParams }: Props) {
  const { event: slug } = await searchParams

  if (!slug) return <ErrorScreen message="קוד האירוע חסר. סרקו את קוד ה-QR מחדש." />
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return <ErrorScreen message="שגיאת הגדרות שרת." />

  const { createServiceRoleClient } = await import('@/lib/supabase/server')
  const supabase = createServiceRoleClient()

  const { data: event } = await supabase
    .from('events').select('*').eq('slug', slug).single<Event>()

  if (!event) return <ErrorScreen message="האירוע לא נמצא. בדקו את קוד ה-QR." />
  if (event.status === 'ended') return <ErrorScreen message="האירוע הסתיים. תודה על ההשתתפות!" />

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-10">

      {/* Logo */}
      <div className="mb-8 animate-slide-in-up">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/image002.png" alt="Maccabi AI Master" className="w-56 mx-auto" />
      </div>

      {/* Main card */}
      <div className="w-full max-w-sm animate-scale-in" style={{ animationDelay: '100ms' }}>

        {/* Rules */}
        <div className="glass rounded-3xl p-6 mb-4">
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-4 font-bold">כללי המשחק</p>
          <div className="flex flex-col gap-3">
            {[
              { icon: '🪙', text: 'מקבלים 1,000 מטבעות לכל האירוע' },
              { icon: '🎯', text: 'בכל סבב מתמודדים על תכונה ניהולית אחת' },
              { icon: '⬆️', text: 'אפשר להגיש הצעה ולהעלות אותה כל עוד הסבב פתוח' },
              { icon: '💸', text: 'ההצעה הסופית שלך נוכית — גם אם לא זכית' },
            ].map(r => (
              <div key={r.icon} className="flex items-start gap-3">
                <span className="text-xl shrink-0">{r.icon}</span>
                <p className="text-slate-300 text-sm leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Warning */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 mb-4 flex items-start gap-2">
          <span className="text-amber-400 text-lg shrink-0">⚠️</span>
          <p className="text-amber-300 text-sm font-semibold">המטרה היא לא לקנות הכול, אלא לבחור מה באמת חשוב לך כמנהל/ת.</p>
        </div>

        {/* Form */}
        <JoinWrapper eventId={event.id} eventSlug={event.slug} />
      </div>
    </main>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="glass rounded-3xl p-8 text-center max-w-sm animate-scale-in">
        <p className="text-4xl mb-4">⚠️</p>
        <p className="text-red-400 text-lg font-semibold">{message}</p>
      </div>
    </main>
  )
}
