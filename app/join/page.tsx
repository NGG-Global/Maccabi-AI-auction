import type { Room } from '@/lib/types'
import { getRoomBySlug, isRoomLive } from '@/lib/rooms/service'
import RoomBrand from '@/components/shared/RoomBrand'
import { Notice } from '@/components/game/ui'
import { UNIT_LABEL, fmt } from '@/components/game/units'
import { RulesList } from '@/app/play/PlayShell'
import JoinWrapper from './JoinWrapper'

function rules(room: Room): string[] {
  const coins = `${fmt(room.starting_coins)} ${UNIT_LABEL}`
  if (room.game_mode === 'allocation') {
    return [
      `מקבלים ${coins} לכל המכירה.`,
      'כל הפריטים פתוחים יחד. מחלקים את התקציב ביניהם.',
      'אפשר לשנות את ההצעות עד שהמנחה סוגר את המכירה.',
      'ההקצאה הגבוהה בכל פריט זוכה בו. בשוויון כל המובילים זוכים יחד.',
      'כל מה שהקציתם יורד מהיתרה, גם בפריטים שלא זכיתם בהם.',
    ]
  }
  return [
    `מקבלים ${coins} לכל המכירה.`,
    'בכל סבב מוצג פריט אחד.',
    'שולחים הצעה ומעלים אותה כל עוד הסבב פתוח.',
    'רק הזוכה משלם את הצעתו. מי שלא זכה שומר על המטבעות.',
    'בשוויון זוכה מי שהציע את הסכום ראשון.',
  ]
}

const NOT_LIVE_MESSAGE: Record<Room['status'], string> = {
  draft: 'הסשן עדיין לא הופעל. המתינו שהמנחה יפעיל אותו ונסו שוב.',
  active: 'חלון ההפעלה של הסשן הסתיים. המנחה יכול להפעיל אותו מחדש.',
  ended: 'המכירה בסשן הזה הסתיימה. תודה על ההשתתפות.',
  archived: 'הסשן הועבר לארכיון ואינו פעיל.',
}

interface Props {
  searchParams: Promise<{ room?: string; event?: string }>
}

export default async function JoinPage({ searchParams }: Props) {
  const params = await searchParams
  // `event` is the parameter printed on older QR codes; both still work.
  const slug = params.room ?? params.event

  if (!slug) return <ErrorScreen message="קוד הסשן חסר. סרקו את קוד ה־QR מחדש." />
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return <ErrorScreen message="שגיאת הגדרות שרת." />

  const room = await getRoomBySlug(slug)
  if (!room) return <ErrorScreen message="הסשן לא נמצא. בדקו את קוד ה־QR." />

  if (!isRoomLive(room)) {
    return (
      <main className="bg-dots flex min-h-screen items-center justify-center px-4" dir="rtl">
        <div className="gm-rise flex w-full max-w-sm flex-col items-center gap-5 rounded-[24px] border-[3px] border-ink bg-card p-6 text-center shadow-piece-md">
          <RoomBrand title={room.title} clientName={room.client_name} logoPath={room.logo_path} size="lg" align="center" />
          <Notice>{NOT_LIVE_MESSAGE[room.status]}</Notice>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-dots flex min-h-screen flex-col items-center px-[14px] py-8" dir="rtl">
      <div className="gm-rise flex w-full max-w-[430px] flex-col gap-4">
        <RoomBrand title={room.title} clientName={room.client_name} logoPath={room.logo_path} size="lg" align="center" />

        <div className="rounded-[24px] border-[3px] border-ink bg-card px-5 py-5 shadow-piece-md">
          <p className="mb-4 mt-0 text-[22px] font-bold text-ink">איך זה עובד</p>
          <RulesList rules={rules(room)} />
        </div>

        <p className="m-0 px-1 text-center text-[15px] leading-relaxed text-ink-3">
          המטרה היא לא לקנות הכול, אלא לבחור מה באמת חשוב לכם.
        </p>

        <JoinWrapper roomId={room.id} roomSlug={room.slug} />
      </div>
    </main>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="bg-dots flex min-h-screen items-center justify-center px-4" dir="rtl">
      <div className="gm-rise w-full max-w-sm rounded-[24px] border-[3px] border-ink bg-card p-6 text-center shadow-piece-md">
        <Notice tone="error">{message}</Notice>
      </div>
    </main>
  )
}
