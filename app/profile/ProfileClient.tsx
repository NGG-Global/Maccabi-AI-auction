'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { ROOM_PUBLIC_COLUMNS, type Participant, type AuctionRound, type Bid, type PublicRoom } from '@/lib/types'
import { isRoundWinner, roundWinnerNames } from '@/lib/game/allocation'
import { EMBED } from '@/lib/supabase/embeds'
import { lastRoomSlug, loadParticipant } from '@/lib/participant-session'
import RoomBrand from '@/components/shared/RoomBrand'
import WalletBar from '@/components/game/WalletBar'
import ParticipantMark from '@/components/game/ParticipantMark'
import { PlaySkeleton, PlayError } from '@/app/play/PlayShell'
import { UNIT_LABEL, fmt, lotNo } from '@/components/game/units'

interface RoundWithBid { round: AuctionRound; bid: Bid; won: boolean }

interface Archetype { title: string; desc: string; mark: string }

function getArchetype(rounds: RoundWithBid[]): Archetype {
  const categorySpend: Record<string, number> = {}
  for (const r of rounds) {
    const cat = r.round.trait?.category ?? 'אחר'
    categorySpend[cat] = (categorySpend[cat] ?? 0) + r.bid.amount
  }
  const top = Object.entries(categorySpend).sort((a, b) => b[1] - a[1])[0]?.[0]
  const archetypes: Record<string, Archetype> = {
    'יחסים':   { title: 'מנהל יחסים', desc: 'משקיעים בקשרים האנושיים ובאמון.', mark: 'י' },
    'מנהיגות': { title: 'מנהיג חזון', desc: 'מובילים עם השראה ואומץ.', mark: 'מ' },
    'שיפוט':   { title: 'מקבל החלטות', desc: 'מצטיינים בשיקול דעת בתנאי אי־ודאות.', mark: 'ש' },
    'למידה':   { title: 'מנהל צמיחה', desc: 'משקיעים בלמידה ובהתפתחות מתמדת.', mark: 'ל' },
  }
  return archetypes[top ?? ''] ?? { title: 'מנהל מאוזן', desc: 'מפזרים את ההשקעה על פני מגוון פריטים.', mark: 'א' }
}

export default function ProfileClient() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const slug = searchParams.get('room') ?? lastRoomSlug()
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [rounds, setRounds] = useState<RoundWithBid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!slug) { setError('לא נמצא סשן. סרקו את קוד ה־QR מחדש.'); setLoading(false); return }
      const { data: r } = await supabase.from('rooms').select(ROOM_PUBLIC_COLUMNS).eq('slug', slug).maybeSingle<PublicRoom>()
      if (!r) { setError('הסשן לא נמצא.'); setLoading(false); return }
      setRoom(r)

      const stored = loadParticipant(r.id)
      if (!stored) { setError('לא נמצאו פרטי משתתף לסשן זה.'); setLoading(false); return }

      const { data: p } = await supabase
        .from('participants').select('*').eq('id', stored.participantId).eq('room_id', r.id).maybeSingle<Participant>()
      if (!p) { setError('המשתתף לא נמצא.'); setLoading(false); return }
      setParticipant(p)

      const { data: bids } = await supabase
        .from('bids')
        .select(`*, ${EMBED.bidRound}(*, ${EMBED.roundTrait}, ${EMBED.roundWinners})`)
        .eq('participant_id', stored.participantId)
        .eq('room_id', r.id)
      const rnd: RoundWithBid[] = ((bids ?? []) as Array<Bid & { round: AuctionRound }>)
        .map(b => ({ round: b.round, bid: b, won: isRoundWinner(b.round, stored.participantId) }))
        .filter(x => x.round?.status === 'closed')
        .sort((a, b) => (a.round.trait?.sort_order ?? 0) - (b.round.trait?.sort_order ?? 0))
      setRounds(rnd)
      setLoading(false)
    }
    load()
  }, [supabase, slug])

  if (loading) return <PlaySkeleton />
  if (error || !participant || !room) return <PlayError message={error ?? 'שגיאה לא צפויה'} />

  const won = rounds.filter(r => r.won)
  const lost = rounds.filter(r => !r.won)
  const archetype = rounds.length > 0 ? getArchetype(rounds) : null
  const isAllocation = room.game_mode === 'allocation'

  return (
    <main className="bg-dots flex min-h-screen flex-col" dir="rtl">
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col gap-4 px-[14px] pb-8 pt-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="inline-flex min-w-0 items-center gap-2 text-[17px] font-semibold text-ink">
            <ParticipantMark name={participant.display_name} size={30} tone="ink" />
            <span className="truncate">{participant.display_name}</span>
          </span>
          <span className="text-[14px] text-ink-3">הפרופיל האישי</span>
        </div>

        <RoomBrand title={room.title} clientName={room.client_name} logoPath={room.logo_path} size="sm" />

        <h1 className="m-0 mx-1 text-[38px] font-bold leading-[1.05] text-ink">
          {won.length > 0
            ? <>זכית ב־<span className="num">{won.length}</span> {won.length === 1 ? 'פריט' : 'פריטים'}</>
            : rounds.length > 0 ? 'לא זכית בפריטים הפעם' : 'עדיין לא השתתפת בסבבים'}
        </h1>

        {archetype && (
          <div className="flex items-center gap-4 rounded-[24px] border-[3px] border-ink bg-card px-5 py-4 shadow-piece-md">
            <ParticipantMark name={archetype.mark} size={56} tone="sky" />
            <div className="min-w-0">
              <p className="m-0 text-[13px] font-semibold text-ink-3">הפרופיל שלך</p>
              <p className="m-0 text-[24px] font-bold leading-tight text-ink">{archetype.title}</p>
              <p className="m-0 mt-1 text-[15px] leading-relaxed text-ink-2">{archetype.desc}</p>
            </div>
          </div>
        )}

        {won.length > 0 && (
          <div className="flex flex-col gap-[14px] py-1">
            {won.map(r => {
              const others = isAllocation ? roundWinnerNames(r.round).filter(n => n !== participant.display_name) : []
              const idx = r.round.trait?.sort_order ?? 0
              return (
                <div key={r.round.id} className="overflow-hidden rounded-[18px] border-[3px] border-ink bg-card text-ink shadow-piece-md">
                  <div className="flex items-center justify-between gap-3 bg-ink px-[18px] py-[14px] text-white">
                    <b className="text-[24px] font-semibold leading-tight">{r.round.trait?.title}</b>
                    {idx > 0 && <span className="shrink-0 text-[17px] font-semibold text-ink-soft">פריט {lotNo(idx)}</span>}
                  </div>
                  <div className="h-[6px] bg-sun" />
                  <div className="flex items-center justify-between px-[18px] pb-4 pt-3 text-[17px] text-ink-3">
                    <span>{others.length > 0 ? `זכייה משותפת עם ${others.join(', ')}` : isAllocation ? 'ההקצאה שלך' : 'מחיר הסגירה'}</span>
                    <b className="num text-[30px] text-ink">{fmt(r.bid.amount)}</b>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {lost.length > 0 && (
          <div className="rounded-[18px] border-[2.5px] border-ink bg-card px-4 py-3">
            <p className="m-0 mb-2 text-[13px] font-semibold text-ink-3">{isAllocation ? 'הקצאות שלא זכו' : 'הצעות שלא זכו'}</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {lost.map(r => (
                <li key={r.round.id} className="flex items-baseline justify-between gap-3 text-[16px]">
                  <span className="min-w-0 flex-1 truncate text-ink-2">{r.round.trait?.title}</span>
                  <span className="num shrink-0 text-[18px] text-ink-2">{fmt(r.bid.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <WalletBar
          variant="tint"
          remaining={participant.wallet_balance}
          total={room.starting_coins}
          unitLabel={UNIT_LABEL}
          label="נשאר לך"
          className="mt-auto"
        />
      </div>
    </main>
  )
}
