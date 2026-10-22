import type { Room } from '@/lib/types'
import { getRoomBySlug, isRoomLive } from '@/lib/rooms/service'
import RoomBrand from '@/components/shared/RoomBrand'
import JoinWrapper from './JoinWrapper'

function rules(room: Room) {
  const coins = room.starting_coins.toLocaleString()
  if (room.game_mode === 'allocation') {
    return [
      { icon: '🪙', text: `מקבלים ${coins} מטבעות לכל האירוע` },
      { icon: '🧩', text: 'כל ההיגדים פתוחים יחד — מחלקים את המטבעות ביניהם' },
      { icon: '✏️', text: 'אפשר לשנות את החלוקה עד שהמנחה סוגר אותה' },
      { icon: '🏆', text: 'ההקצאה הגבוהה ביותר בכל היגד זוכה בו; בשוויון כל המובילים זוכים יחד' },
      { icon: '💸', text: 'כל המטבעות שהוקצו יורדים מהיתרה — גם בהיגדים שלא זכית בהם' },
    ]
  }
  return [
    { icon: '🪙', text: `מקבלים ${coins} מטבעות לכל האירוע` },
    { icon: '🎯', text: 'בכל סבב מתמודדים על היגד ניהולי אחד' },
    { icon: '⬆️', text: 'אפשר להגיש הצעה ולהעלות אותה כל עוד הסבב פתוח' },
    { icon: '💸', text: 'רק הזוכה משלם את הצעתו — מי שלא זכה שומר על המטבעות' },
    { icon: '⏱️', text: 'בשוויון זוכה מי שהציע את הסכום ראשון' },
  ]
}

const NOT_LIVE_MESSAGE: Record<Room['status'], string> = {
  draft: 'החדר עדיין לא הופעל. המתינו שהמנחה יפעיל אותו ונסו שוב.',
  active: 'חלון ההפעלה של החדר הסתיים. המנחה יכול להפעיל אותו מחדש.',
  ended: 'האירוע בחדר זה הסתיים. תודה על ההשתתפות!',
  archived: 'החדר הועבר לארכיון ואינו פעיל.',
}

interface Props {
  searchParams: Promise<{ room?: string; event?: string }>
}

export default async function JoinPage({ searchParams }: Props) {
  const params = await searchParams
  // `event` is the parameter printed on older QR codes; both still work.
  const slug = params.room ?? params.event

  if (!slug) return <ErrorScreen message="קוד החדר חסר. סרקו את קוד ה-QR מחדש." />
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return <ErrorScreen message="שגיאת הגדרות שרת." />

  const room = await getRoomBySlug(slug)
  if (!room) return <ErrorScreen message="החדר לא נמצא. בדקו את קוד ה-QR." />

  if (!isRoomLive(room)) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="glass rounded-3xl p-8 text-center max-w-sm animate-scale-in flex flex-col items-center gap-4">
          <RoomBrand title={room.title} clientName={room.client_name} logoPath={room.logo_path} size="lg" align="center" />
          <p className="text-4xl">⏸️</p>
          <p className="text-slate-200 text-lg font-semibold leading-relaxed">{NOT_LIVE_MESSAGE[room.status]}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm animate-scale-in" style={{ animationDelay: '100ms' }}>

        <div className="mb-5">
          <RoomBrand title={room.title} clientName={room.client_name} logoPath={room.logo_path} size="lg" align="center" />
        </div>

        {/* Rules */}
        <div className="glass rounded-3xl p-6 mb-4">
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-4 font-bold">כללי המשחק</p>
          <div className="flex flex-col gap-3">
            {rules(room).map(r => (
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
        <JoinWrapper roomId={room.id} roomSlug={room.slug} />
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
