export interface BucketSettings {
  readonly capacity: number
  readonly refillPerSecond: number
}

export interface TokenBucket {
  readonly tokens: number
  readonly refilledAt: number
}

export interface TakeResult {
  readonly allowed: boolean
  readonly bucket: TokenBucket
}

const MILLISECONDS_PER_SECOND = 1000

export function fullBucket(settings: BucketSettings, now: number): TokenBucket {
  return { tokens: settings.capacity, refilledAt: now }
}

function refilled(bucket: TokenBucket, settings: BucketSettings, now: number): TokenBucket {
  const elapsedSeconds = Math.max(0, now - bucket.refilledAt) / MILLISECONDS_PER_SECOND
  const tokens = Math.min(settings.capacity, bucket.tokens + elapsedSeconds * settings.refillPerSecond)
  return { tokens, refilledAt: Math.max(bucket.refilledAt, now) }
}

export function takeTokens(bucket: TokenBucket, settings: BucketSettings, cost: number, now: number): TakeResult {
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(now)) return { allowed: false, bucket }
  const current = refilled(bucket, settings, now)
  if (cost > current.tokens) return { allowed: false, bucket: current }
  return { allowed: true, bucket: { tokens: current.tokens - cost, refilledAt: current.refilledAt } }
}
