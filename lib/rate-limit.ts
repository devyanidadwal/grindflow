// Simple per-user in-memory token bucket rate limiter.
// Good enough for a single-instance Next.js app. If you deploy to
// multiple instances, swap in Upstash Redis or similar.

type Bucket = { tokens: number; lastRefill: number }

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetMs: number // ms until next token available
}

// Defaults tuned for Gemini free tier (15 RPM overall).
// Keep per-user well below that so 3-4 users can share.
export function checkRateLimit(
  key: string,
  capacity: number,
  refillPerMinute: number
): RateLimitResult {
  const now = Date.now()
  const refillRateMs = 60_000 / refillPerMinute
  const b = buckets.get(key) ?? { tokens: capacity, lastRefill: now }

  // Refill based on elapsed time
  const elapsed = now - b.lastRefill
  const tokensToAdd = Math.floor(elapsed / refillRateMs)
  if (tokensToAdd > 0) {
    b.tokens = Math.min(capacity, b.tokens + tokensToAdd)
    b.lastRefill = b.lastRefill + tokensToAdd * refillRateMs
  }

  if (b.tokens <= 0) {
    const resetMs = refillRateMs - (now - b.lastRefill)
    buckets.set(key, b)
    return { allowed: false, remaining: 0, resetMs: Math.max(0, Math.ceil(resetMs)) }
  }

  b.tokens -= 1
  buckets.set(key, b)
  return { allowed: true, remaining: b.tokens, resetMs: 0 }
}

// Opinionated wrapper for AI-heavy endpoints.
// 6 calls per minute per user, burst of 3.
export function checkAiRateLimit(userId: string, bucket: string) {
  return checkRateLimit(`ai:${bucket}:${userId}`, 3, 6)
}

export function rateLimitHeaders(r: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset-Ms': String(r.resetMs),
    ...(r.resetMs > 0 ? { 'Retry-After': String(Math.ceil(r.resetMs / 1000)) } : {}),
  }
}
