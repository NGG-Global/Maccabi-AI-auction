/**
 * Where a phone keeps its participant identity, per room, so a phone that
 * joined two rooms (a rehearsal and the real event, say) never mixes them
 * up. Browser-only; every function guards against a missing localStorage.
 */

export interface StoredParticipant {
  participantId: string
  sessionToken: string
}

const LAST_ROOM_KEY = 'auction:last_room'
const key = (roomId: string) => `auction:room:${roomId}`

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function saveParticipant(roomId: string, roomSlug: string, data: StoredParticipant): void {
  const s = storage()
  if (!s) return
  try {
    s.setItem(key(roomId), JSON.stringify(data))
    s.setItem(LAST_ROOM_KEY, roomSlug)
  } catch {
    // Private mode or full storage: the participant will have to rejoin.
  }
}

export function loadParticipant(roomId: string): StoredParticipant | null {
  const s = storage()
  if (!s) return null
  try {
    const raw = s.getItem(key(roomId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredParticipant>
    if (typeof parsed.participantId !== 'string' || typeof parsed.sessionToken !== 'string') return null
    return { participantId: parsed.participantId, sessionToken: parsed.sessionToken }
  } catch {
    return null
  }
}

export function clearParticipant(roomId: string): void {
  const s = storage()
  if (!s) return
  try { s.removeItem(key(roomId)) } catch { /* ignore */ }
}

/** Slug of the room this phone joined most recently (for /play without ?room=). */
export function lastRoomSlug(): string | null {
  const s = storage()
  if (!s) return null
  try { return s.getItem(LAST_ROOM_KEY) } catch { return null }
}
