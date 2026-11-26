import { ContractErrorCode } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { admitOwnerCall, CallFamily, CallLimiter, LimitedBucket, MAX_TRACKED_OWNERS, type OwnerBuckets } from '../../../src/client/domain/call-limits'

const START = 100_000
const SECOND = 1000
const BURST = 60
const REFILL = 30
const NOTIFICATION_BURST = 5
const QUARTER_MEGABYTE = 262_144
const HALF_MEGABYTE = 524_288
const SMALL = 10
const SPAM = 100
const FOUR = 4
const THREE = 3
const POISON = -5
const OWNER = 'omk_shop'
const OTHER_OWNER = 'omk_bank'
const MANY_OWNERS = 50_000
const ADMISSIONS = 100_000
const TIME_BUDGET_MS = 3000
const NON_FINITE = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

interface Run {
  readonly buckets: OwnerBuckets | undefined
  readonly refusals: readonly (string | undefined)[]
}

function deepFrozen<Value>(value: Value): Value {
  if (typeof value === 'object' && value !== null) Object.values(value).forEach(deepFrozen)
  return Object.freeze(value)
}

function run(count: number, family: CallFamily, bytes: number, now: number, from?: OwnerBuckets): Run {
  let buckets = from
  const refusals: (string | undefined)[] = []
  for (let index = 0; index < count; index += 1) {
    const result = admitOwnerCall(buckets === undefined ? undefined : deepFrozen(buckets), family, bytes, now)
    buckets = result.buckets
    if (result.refusal !== null) refusals.push(result.refusal.detail)
  }
  return { buckets, refusals }
}

function limiterRun(limiter: CallLimiter, count: number, owner: string, family: CallFamily, bytes: number, now: number): readonly (string | undefined)[] {
  const refusals: (string | undefined)[] = []
  for (let index = 0; index < count; index += 1) {
    const refusal = limiter.admit(owner, family, bytes, now)
    if (refusal !== null) refusals.push(refusal.detail)
  }
  return refusals
}

describe('call limits: calls', () => {
  it('admits a burst of 60 and refuses the 61st with the calls detail', () => {
    const first = run(BURST, CallFamily.Other, SMALL, START)
    expect(first.refusals).toEqual([])
    const refused = admitOwnerCall(first.buckets, CallFamily.Other, SMALL, START)
    expect(refused.refusal).toEqual({ path: '', code: ContractErrorCode.RateLimited, detail: LimitedBucket.Calls })
    expect(refused.buckets).toBe(first.buckets)
  })

  it('refills 30 calls per second', () => {
    const drained = run(BURST, CallFamily.Other, SMALL, START)
    expect(run(BURST, CallFamily.Other, SMALL, START + SECOND, drained.buckets).refusals).toHaveLength(BURST - REFILL)
  })

  it('does not return the shared input: a refused call leaves the input untouched', () => {
    const drained = run(BURST, CallFamily.Other, SMALL, START).buckets
    expect(run(SPAM, CallFamily.Other, SMALL, START, drained).refusals).toHaveLength(SPAM)
    expect(admitOwnerCall(drained, CallFamily.Other, SMALL, START + SECOND).refusal).toBeNull()
  })
})

describe('call limits: notifications', () => {
  it('refuses the 6th notification within the second', () => {
    const first = run(NOTIFICATION_BURST, CallFamily.Notify, SMALL, START)
    expect(first.refusals).toEqual([])
    expect(admitOwnerCall(first.buckets, CallFamily.Notify, SMALL, START).refusal?.detail).toBe(LimitedBucket.Notifications)
  })

  it('does not count other calls as notifications, nor notifications as calls', () => {
    const others = run(NOTIFICATION_BURST, CallFamily.Other, SMALL, START).buckets
    expect(admitOwnerCall(others, CallFamily.Notify, SMALL, START).refusal).toBeNull()
    const notified = run(NOTIFICATION_BURST, CallFamily.Notify, SMALL, START).buckets
    expect(run(BURST, CallFamily.Other, SMALL, START, notified).refusals).toEqual([])
  })

  it('refills 5 per second', () => {
    const drained = run(NOTIFICATION_BURST, CallFamily.Notify, SMALL, START).buckets
    expect(run(NOTIFICATION_BURST, CallFamily.Notify, SMALL, START + SECOND, drained).refusals).toEqual([])
  })

  it('spends the bytes budget of a notification', () => {
    const notified = run(FOUR, CallFamily.Notify, QUARTER_MEGABYTE, START).buckets
    expect(admitOwnerCall(notified, CallFamily.Notify, QUARTER_MEGABYTE, START).refusal?.detail).toBe(LimitedBucket.Bytes)
  })
})

describe('call limits: bytes', () => {
  it('refuses the 5th call of 256 KB with the bytes detail', () => {
    const first = run(FOUR, CallFamily.Other, QUARTER_MEGABYTE, START)
    expect(first.refusals).toEqual([])
    expect(admitOwnerCall(first.buckets, CallFamily.Other, QUARTER_MEGABYTE, START).refusal?.detail).toBe(LimitedBucket.Bytes)
  })

  it('refills with the clock', () => {
    const drained = run(FOUR, CallFamily.Other, QUARTER_MEGABYTE, START).buckets
    expect(admitOwnerCall(drained, CallFamily.Other, QUARTER_MEGABYTE, START + SECOND).refusal).toBeNull()
  })

  it('counts a call only when calls and bytes both pass, and still refuses past the burst', () => {
    const used = run(THREE, CallFamily.Other, QUARTER_MEGABYTE, START).buckets
    const refused = run(SPAM, CallFamily.Other, HALF_MEGABYTE, START, used)
    expect(refused.refusals).toHaveLength(SPAM)
    const small = run(BURST - THREE, CallFamily.Other, 1, START, refused.buckets)
    expect(small.refusals).toEqual([])
    expect(admitOwnerCall(small.buckets, CallFamily.Other, 1, START).refusal?.detail).toBe(LimitedBucket.Calls)
  })
})

describe('call limits: hostile input', () => {
  it.each(NON_FINITE)('refuses a clock of %s without creating buckets', (now) => {
    const result = admitOwnerCall(undefined, CallFamily.Other, SMALL, now)
    expect(result.refusal?.code).toBe(ContractErrorCode.RateLimited)
    expect(result.buckets).toBeUndefined()
  })

  it.each([...NON_FINITE, POISON])('refuses a byte cost of %s and stays limited afterwards', (bytes) => {
    const poisoned = admitOwnerCall(undefined, CallFamily.Other, bytes, START)
    expect(poisoned.refusal?.detail).toBe(LimitedBucket.Bytes)
    const after = run(BURST, CallFamily.Other, SMALL, START, poisoned.buckets)
    expect(after.refusals).toEqual([])
    expect(admitOwnerCall(after.buckets, CallFamily.Other, SMALL, START).refusal?.detail).toBe(LimitedBucket.Calls)
  })
})

describe('call limiter', () => {
  it('accepts the first call of a new limiter whatever happened to another one', () => {
    const exhausted = new CallLimiter()
    limiterRun(exhausted, BURST + SPAM, OWNER, CallFamily.Other, SMALL, START)
    expect(exhausted.admit(OWNER, CallFamily.Other, SMALL, START)?.detail).toBe(LimitedBucket.Calls)
    expect(new CallLimiter().admit(OWNER, CallFamily.Other, SMALL, START)).toBeNull()
  })

  it('keeps owners apart, including inherited property names', () => {
    const limiter = new CallLimiter()
    limiterRun(limiter, BURST + 1, OWNER, CallFamily.Other, SMALL, START)
    ;[OTHER_OWNER, '__proto__', 'toString', 'constructor'].forEach((owner) => {
      expect(limiter.admit(owner, CallFamily.Other, SMALL, START)).toBeNull()
    })
  })

  it('creates no owner for a refused first call or a clock that is not finite', () => {
    const limiter = new CallLimiter()
    limiter.admit(OWNER, CallFamily.Other, Number.NaN, START)
    limiter.admit(OTHER_OWNER, CallFamily.Other, SMALL, Number.NaN)
    expect(limiter.trackedOwners).toBe(0)
  })

  it('forgets an owner: a restarted resource gets a full bucket', () => {
    const limiter = new CallLimiter()
    limiterRun(limiter, BURST, OWNER, CallFamily.Other, SMALL, START)
    limiter.forget(OWNER)
    expect(limiter.trackedOwners).toBe(0)
    expect(limiterRun(limiter, BURST, OWNER, CallFamily.Other, SMALL, START)).toEqual([])
    limiter.forget('unknown')
  })

  it('refuses a new owner past the tracked bound, and keeps serving the known ones', () => {
    const limiter = new CallLimiter()
    for (let index = 0; index < MAX_TRACKED_OWNERS; index += 1) limiter.admit(`owner_${String(index)}`, CallFamily.Other, SMALL, START)
    expect(limiter.admit('one_too_many', CallFamily.Other, SMALL, START)?.detail).toBe(LimitedBucket.Owners)
    expect(limiter.admit('owner_0', CallFamily.Other, SMALL, START)).toBeNull()
    limiter.forget('owner_0')
    expect(limiter.admit('one_too_many', CallFamily.Other, SMALL, START)).toBeNull()
  })

  it('stays constant per admission with many known owners', () => {
    const fill = (limiter: CallLimiter): void => {
      for (let index = 0; index < MANY_OWNERS; index += 1) limiter.admit(`owner_${String(index % MAX_TRACKED_OWNERS)}`, CallFamily.Other, 1, START)
    }
    fill(new CallLimiter())
    const limiter = new CallLimiter()
    fill(limiter)
    const started = Date.now()
    for (let index = 0; index < ADMISSIONS; index += 1) limiter.admit(OWNER, CallFamily.Other, 1, START + index)
    expect(Date.now() - started).toBeLessThan(TIME_BUDGET_MS)
  })
})
