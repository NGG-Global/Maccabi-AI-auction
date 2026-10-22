'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { ROOM_PUBLIC_COLUMNS, type PublicRoom } from '@/lib/types'
import { lastRoomSlug, loadParticipant, type StoredParticipant } from '@/lib/participant-session'
import AuctionPlay from './AuctionPlay'
import AllocationPlay from './AllocationPlay'
import { PlaySkeleton, PlayError } from './PlayShell'

interface Session {
  room: PublicRoom
  participant: StoredParticipant
}

/**
 * Resolves the room (?room=<slug>, or the last room this phone joined) and
 * this phone's participant in it, then shows the screen for the game mode.
 */
export default function PlayClient() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const slug = searchParams.get('room') ?? lastRoomSlug()
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(slug ? null : 'לא נמצא חדר. סרקו את קוד ה-QR מחדש.')

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      const { data: room, error: rErr } = await supabase
        .from('rooms').select(ROOM_PUBLIC_COLUMNS).eq('slug', slug).maybeSingle<PublicRoom>()
      if (cancelled) return
      if (rErr) { setError('שגיאה בטעינת הנתונים. רעננו את הדף.'); return }
      if (!room) { setError('החדר לא נמצא. סרקו את קוד ה-QR מחדש.'); return }

      const participant = loadParticipant(room.id)
      if (!participant) { setError('לא נמצאו פרטי משתתף לחדר זה. סרקו את קוד ה-QR והירשמו.'); return }

      // The game screen loads (and validates) the participant itself; no extra round trip here.
      setSession({ room, participant })
    })()
    return () => { cancelled = true }
  }, [supabase, slug])

  if (error) return <PlayError message={error} />
  if (!session) return <PlaySkeleton />

  return session.room.game_mode === 'allocation' ? (
    <AllocationPlay room={session.room} participantId={session.participant.participantId} sessionToken={session.participant.sessionToken} />
  ) : (
    <AuctionPlay room={session.room} participantId={session.participant.participantId} sessionToken={session.participant.sessionToken} />
  )
}
