'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { Event, GameMode } from '@/lib/types'
import { resolveGameMode } from '@/lib/game/allocation'
import AuctionPlay from './AuctionPlay'
import AllocationPlay from './AllocationPlay'
import { PlaySkeleton, PlayError } from './PlayShell'

interface Session {
  participantId: string
  eventId: string
  mode: GameMode
}

/** Resolves the participant's event and shows the screen for its game mode. */
export default function PlayClient() {
  const supabase = useMemo(() => createClient(), [])
  // Client-only component (ssr: false), so localStorage is available here.
  const [participantId] = useState(() => localStorage.getItem('auction_participant_id'))
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(
    participantId ? null : 'לא נמצא פרטי משתתף. סרקו את קוד ה-QR מחדש.',
  )

  useEffect(() => {
    if (!participantId) return
    let cancelled = false
    ;(async () => {
      const { data: participant, error: pErr } = await supabase
        .from('participants').select('id, event_id').eq('id', participantId).maybeSingle()
      if (cancelled) return
      if (pErr) { setError('שגיאה בטעינת הנתונים. רעננו את הדף.'); return }
      if (!participant) { setError('המשתתף לא נמצא. סרקו את קוד ה-QR מחדש.'); return }

      // select('*') so this still works before migration 008 adds game_mode.
      const { data: event } = await supabase
        .from('events').select('*').eq('id', participant.event_id).maybeSingle<Event>()
      if (cancelled) return
      setSession({
        participantId,
        eventId: participant.event_id,
        mode: resolveGameMode(event?.game_mode),
      })
    })()
    return () => { cancelled = true }
  }, [supabase, participantId])

  const handleModeChange = useCallback((mode: GameMode) => {
    setSession(prev => (prev && prev.mode !== mode ? { ...prev, mode } : prev))
  }, [])

  if (error) return <PlayError message={error} />
  if (!session) return <PlaySkeleton />

  return session.mode === 'allocation' ? (
    <AllocationPlay
      participantId={session.participantId}
      eventId={session.eventId}
      onModeChange={handleModeChange}
    />
  ) : (
    <AuctionPlay onModeChange={handleModeChange} />
  )
}
