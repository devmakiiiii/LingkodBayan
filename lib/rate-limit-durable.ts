import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from './logger'
import { rateLimiter } from './rate-limit'

export interface DurableRateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  /** True when the count was enforced via Postgres (shared across instances). */
  durable: boolean
}

export interface DurableRateLimitOptions {
  /** Sliding window length in milliseconds. */
  intervalMs: number
  /** Maximum number of allowed attempts per window. */
  limit: number
}

/**
 * Cross-instance rate limiting for sensitive server actions (password reset,
 * sign-up OTP). The in-memory limiter in `lib/rate-limit.ts` resets on every
 * serverless cold start, so production abuse protection is enforced through
 * the `consume_rate_limit` Postgres function (scripts/33_rate_limits.sql),
 * which performs an atomic upsert so all instances share one counter.
 *
 * Fail-open philosophy: if the durable check cannot run (missing migration,
 * transient database error), we fall back to the in-memory limiter so a
 * database outage never locks citizens out of account recovery — while still
 * keeping some protection in place.
 */
export async function durableRateLimit(
  key: string,
  { intervalMs, limit }: DurableRateLimitOptions,
): Promise<DurableRateLimitResult> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_key: key,
      p_interval_seconds: Math.ceil(intervalMs / 1000),
      p_limit: limit,
    })

    if (error) throw error

    const allowed = data === true
    return {
      allowed,
      remaining: allowed ? Math.max(0, limit - 1) : 0,
      resetTime: Date.now() + intervalMs,
      durable: true,
    }
  } catch (error) {
    logger.warn('Durable rate limit unavailable, falling back to in-memory', {
      context: 'rate-limit',
      key,
      error,
    })

    const fallback = rateLimiter.check(key, { interval: intervalMs, limit })
    return { ...fallback, durable: false }
  }
}
