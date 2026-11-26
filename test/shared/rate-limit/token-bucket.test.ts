import { describe, expect, it } from 'vitest'
import { fullBucket, takeTokens, type BucketSettings, type TokenBucket } from '../../../src/shared/rate-limit/token-bucket'

const CALLS: BucketSettings = { capacity: 60, refillPerSecond: 30 }
const BYTES: BucketSettings = { capacity: 1_048_576, refillPerSecond: 1_048_576 }
const START = 10_000
const SECOND = 1000
const HALF_SECOND = 500
const NEGATIVE_COST = -5
const BURST = 60
const OVER_BURST = 61
const REFILL = 30
const HALF_REFILL = 15
const LONG_WAIT_SECONDS = 100

function takeMany(settings: BucketSettings, count: number, now: number): { readonly allowed: number; readonly bucket: TokenBucket } {
  let bucket = fullBucket(settings, now)
  let allowed = 0
  for (let index = 0; index < count; index += 1) {
    const result = takeTokens(bucket, settings, 1, now)
    bucket = result.bucket
    if (result.allowed) allowed += 1
  }
  return { allowed, bucket }
}

describe('token bucket', () => {
  it('starts full', () => {
    expect(fullBucket(CALLS, START)).toEqual({ tokens: BURST, refilledAt: START })
  })

  it('allows a burst of 60 then refuses', () => {
    const outcome = takeMany(CALLS, OVER_BURST, START)
    expect(outcome.allowed).toBe(CALLS.capacity)
    expect(takeTokens(outcome.bucket, CALLS, 1, START).allowed).toBe(false)
  })

  it('refills 30 per second', () => {
    const drained = takeMany(CALLS, BURST, START).bucket
    const later = takeTokens(drained, CALLS, REFILL, START + SECOND)
    expect(later.allowed).toBe(true)
    expect(takeTokens(later.bucket, CALLS, 1, START + SECOND).allowed).toBe(false)
    const half = takeTokens(drained, CALLS, HALF_REFILL, START + HALF_SECOND)
    expect(half.allowed).toBe(true)
  })

  it('never refills above capacity', () => {
    const later = takeTokens(fullBucket(CALLS, START), CALLS, 1, START + SECOND * LONG_WAIT_SECONDS)
    expect(later.bucket.tokens).toBe(CALLS.capacity - 1)
  })

  it('meters bytes at 1 048 576 per second', () => {
    const first = takeTokens(fullBucket(BYTES, START), BYTES, BYTES.capacity, START)
    expect(first.allowed).toBe(true)
    expect(first.bucket.tokens).toBe(0)
    expect(takeTokens(first.bucket, BYTES, 1, START).allowed).toBe(false)
    expect(takeTokens(first.bucket, BYTES, BYTES.capacity, START + SECOND).allowed).toBe(true)
  })

  it('does not refill when the clock goes backwards and never goes negative', () => {
    const drained = takeMany(CALLS, BURST, START).bucket
    const backwards = takeTokens(drained, CALLS, 1, START - SECOND)
    expect(backwards.allowed).toBe(false)
    expect(backwards.bucket.tokens).toBe(0)
    expect(backwards.bucket.tokens).toBeGreaterThanOrEqual(0)
    const resumed = takeTokens(backwards.bucket, CALLS, REFILL, START + SECOND)
    expect(resumed.allowed).toBe(true)
    expect(takeTokens(resumed.bucket, CALLS, 1, START + SECOND).allowed).toBe(false)
  })

  it('refuses a cost above capacity without draining the bucket', () => {
    const bucket = fullBucket(BYTES, START)
    const result = takeTokens(bucket, BYTES, BYTES.capacity + 1, START)
    expect(result.allowed).toBe(false)
    expect(result.bucket.tokens).toBe(BYTES.capacity)
    expect(takeTokens(result.bucket, BYTES, BYTES.capacity, START).allowed).toBe(true)
  })

  it('does not mutate its input', () => {
    const bucket = Object.freeze(fullBucket(CALLS, START))
    expect(() => takeTokens(bucket, CALLS, 1, START + 1)).not.toThrow()
    expect(bucket.tokens).toBe(CALLS.capacity)
  })

  describe('fails closed', () => {
    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, NEGATIVE_COST])('refuses the cost %s and returns the bucket intact', (cost) => {
      const bucket = fullBucket(CALLS, START)
      const result = takeTokens(bucket, CALLS, cost, START + SECOND)
      expect(result.allowed).toBe(false)
      expect(result.bucket).toBe(bucket)
      expect(takeTokens(result.bucket, CALLS, 1, START).allowed).toBe(true)
    })

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('refuses the clock %s and returns the bucket intact', (now) => {
      const bucket = fullBucket(CALLS, START)
      const result = takeTokens(bucket, CALLS, 1, now)
      expect(result.allowed).toBe(false)
      expect(result.bucket).toBe(bucket)
      const later = takeTokens(result.bucket, CALLS, 1, START + SECOND)
      expect(later.allowed).toBe(true)
    })

    it('keeps limiting after a poisoned call', () => {
      const drained = takeMany(CALLS, BURST, START).bucket
      const poisoned = takeTokens(drained, CALLS, Number.NaN, START).bucket
      expect(takeTokens(poisoned, CALLS, 1, START).allowed).toBe(false)
    })

    it('never creates tokens when the clock goes backwards and forwards', () => {
      const drained = takeMany(CALLS, BURST, START).bucket
      const back = takeTokens(drained, CALLS, 0, START - SECOND * LONG_WAIT_SECONDS).bucket
      const forward = takeTokens(back, CALLS, 0, START + SECOND).bucket
      expect(forward.tokens).toBeLessThanOrEqual(REFILL)
      expect(forward.tokens).toBeLessThanOrEqual(CALLS.capacity)
    })
  })
})
