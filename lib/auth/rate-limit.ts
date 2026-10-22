import 'server-only'
import type { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Login rate limiting, backed by auction.staff_login_attempts (migration 011).
 * Vercel functions are stateless, so the counter cannot live in memory.
 *
 * Policy: at most MAX_FAILED failed attempts per IP in a WINDOW_MINUTES
 * window. Successful logins are not recorded.
 */
export const MAX_FAILED_ATTEMPTS = 10
export const WINDOW_MINUTES = 15

export interface RateLimitVerdict {
  allowed: boolean
  retryAfterSeconds: number
  failedAttempts: number
}

/** Client IP as seen through the platform's proxy; 'unknown' when absent. */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first.slice(0, 64)
  }
  const real = req.headers.get('x-real-ip')?.trim()
  return real ? real.slice(0, 64) : 'unknown'
}

export async function checkLoginRateLimit(ip: string): Promise<RateLimitVerdict> {
  const supabase = createServiceRoleClient()
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('staff_login_attempts')
    .select('attempted_at')
    .eq('ip', ip)
    .gte('attempted_at', since)
    .order('attempted_at', { ascending: true })

  if (error) {
    // Fail closed: a login that cannot be rate-limited is refused.
    console.error('rate limit lookup failed:', error)
    return { allowed: false, retryAfterSeconds: 60, failedAttempts: MAX_FAILED_ATTEMPTS }
  }

  const failed = data?.length ?? 0
  if (failed < MAX_FAILED_ATTEMPTS) return { allowed: true, retryAfterSeconds: 0, failedAttempts: failed }

  const oldest = new Date(data![0].attempted_at as string).getTime()
  const retryAfterSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MINUTES * 60 * 1000 - Date.now()) / 1000))
  return { allowed: false, retryAfterSeconds, failedAttempts: failed }
}

export async function recordFailedLogin(ip: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('staff_login_attempts').insert({ ip })
  if (error) console.error('rate limit insert failed:', error)
  // Keep the table small: rows older than a day serve no purpose.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await supabase.from('staff_login_attempts').delete().lt('attempted_at', cutoff)
}
