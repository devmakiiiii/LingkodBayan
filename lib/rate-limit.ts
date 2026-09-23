export interface RateLimitOptions {
  interval: number
  limit: number
}

interface RateLimitRecord {
  count: number
  resetTime: number
}

class RateLimiter {
  private store = new Map<string, RateLimitRecord>()

  check(key: string, options: RateLimitOptions): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const record = this.store.get(key)

    if (!record || now > record.resetTime) {
      const resetTime = now + options.interval
      this.store.set(key, { count: 1, resetTime })
      return { allowed: true, remaining: options.limit - 1, resetTime }
    }

    if (record.count >= options.limit) {
      return { allowed: false, remaining: 0, resetTime: record.resetTime }
    }

    record.count++
    return { allowed: true, remaining: options.limit - record.count, resetTime: record.resetTime }
  }

  reset(key: string): void {
    this.store.delete(key)
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, record] of this.store) {
      if (now > record.resetTime) {
        this.store.delete(key)
      }
    }
  }
}

export const rateLimiter = new RateLimiter()

if (typeof setInterval !== 'undefined') {
  setInterval(() => rateLimiter.cleanup(), 60000)
}

export function rateLimit(options: RateLimitOptions) {
  return (request: { ip?: string; headers: Headers }) => {
    // Use the first value of x-forwarded-for: clients can append arbitrary
    // entries, but the leftmost address is the one the trusted edge added.
    const forwardedFor = request.headers.get('x-forwarded-for')
    const key = request.ip || forwardedFor?.split(',')[0]?.trim() || 'global'
    return rateLimiter.check(key, options)
  }
}
