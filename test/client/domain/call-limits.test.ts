import { ContractErrorCode } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { admitCall, CallFamily, EMPTY_CALL_LIMITS, LimitedBucket, type CallLimitsState } from '../../../src/client/domain/call-limits'

const SMALL = 10
const SPAM = 100
const REFILL = 30
const FOUR = 4
const THREE = 3
const POISON = -5

const START = 100_000
const SECOND = 1000
const BURST = 60
const NOTIFICATION_BURST = 5
const QUARTER_MEGABYTE = 262_144
const HALF_MEGABYTE = 524_288
const OWNER = 'omk_shop'
const OTHER_OWNER = 'omk_bank'
const MANY_OWNERS = 50_000
const TIME_BUDGET_MS = 3000
const NON_FINITE = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

interface Run {
  readonly state: CallLimitsState
  readonly refusals: readonly (string | undefined)[]
}

function run(count: number, owner: string, family: typeof CallFamily[keyof typeof CallFamily], bytes: number, now: number, from: CallLimitsState = EMPTY_CALL_LIMITS): Run {
  let state = from
  const refusals: (string | undefined)[] = []
  for (let index = 0; index < count; index += 1) {
    const result = admitCall(state, owner, family, bytes, now)
    state = result.state
    if (result.refusal !== null) refusals.push(result.refusal.detail)
  }
  return { state, refusals }
}

describe('call limits: calls', () => {
  it('admits a burst of 60 and refuses the 61st with the calls detail', () => {
    const first = run(BURST, OWNER, CallFamily.Other, SMALL, START)
    expect(first.refusals).toEqual([])
    const refused = admitCall(first.state, OWNER, CallFamily.Other, SMALL, START)
    expect(refused.refusal).toEqual({ path: '', code: ContractErrorCode.RateLimited, detail: LimitedBucket.Calls })
  })

  it('refills 30 calls per second', () => {
    const drained = run(BURST, OWNER, CallFamily.Other, SMALL, START)
    const later = run(BURST, OWNER, CallFamily.Other, SMALL, START + SECOND, drained.state)
    expect(later.refusals).toHaveLength(BURST - REFILL)
  })

  it('keeps owners apart', () => {
    const drained = run(BURST + 1, OWNER, CallFamily.Other, SMALL, START)
    expect(admitCall(drained.state, OTHER_OWNER, CallFamily.Other, SMALL, START).refusal).toBeNull()
  })

  it('treats inherited property names as ordinary owners', () => {
    const state = run(1, '__proto__', CallFamily.Other, SMALL, START).state
    expect(admitCall(state, 'toString', CallFamily.Other, SMALL, START).refusal).toBeNull()
    expect(admitCall(state, 'constructor', CallFamily.Other, SMALL, START).refusal).toBeNull()
  })
})

describe('call limits: notifications', () => {
  it('refuses the 6th notification within the second', () => {
    const first = run(NOTIFICATION_BURST, OWNER, CallFamily.Notify, SMALL, START)
    expect(first.refusals).toEqual([])
    expect(admitCall(first.state, OWNER, CallFamily.Notify, SMALL, START).refusal?.detail).toBe(LimitedBucket.Notifications)
  })

  it('does not count other calls as notifications', () => {
    const state = run(NOTIFICATION_BURST, OWNER, CallFamily.Other, SMALL, START).state
    expect(admitCall(state, OWNER, CallFamily.Notify, SMALL, START).refusal).toBeNull()
  })

  it('refills 5 per second', () => {
    const drained = run(NOTIFICATION_BURST, OWNER, CallFamily.Notify, SMALL, START).state
    expect(run(NOTIFICATION_BURST, OWNER, CallFamily.Notify, SMALL, START + SECOND, drained).refusals).toEqual([])
  })

  it('does not spend the call or byte budget of a refused notification', () => {
    const drained = run(NOTIFICATION_BURST, OWNER, CallFamily.Notify, SMALL, START).state
    const spammed = run(SPAM, OWNER, CallFamily.Notify, SMALL, START, drained).state
    const others = run(BURST - NOTIFICATION_BURST, OWNER, CallFamily.Other, SMALL, START, spammed)
    expect(others.refusals).toEqual([])
  })
})

describe('call limits: bytes', () => {
  it('refuses the 5th call of 256 KB with the bytes detail', () => {
    const first = run(FOUR, OWNER, CallFamily.Other, QUARTER_MEGABYTE, START)
    expect(first.refusals).toEqual([])
    expect(admitCall(first.state, OWNER, CallFamily.Other, QUARTER_MEGABYTE, START).refusal?.detail).toBe(LimitedBucket.Bytes)
  })

  it('refills with the clock', () => {
    const drained = run(FOUR, OWNER, CallFamily.Other, QUARTER_MEGABYTE, START).state
    expect(admitCall(drained, OWNER, CallFamily.Other, QUARTER_MEGABYTE, START + SECOND).refusal).toBeNull()
  })

  it('counts a call only when calls and bytes both pass', () => {
    const used = run(THREE, OWNER, CallFamily.Other, QUARTER_MEGABYTE, START).state
    const refused = run(SPAM, OWNER, CallFamily.Other, HALF_MEGABYTE, START, used)
    expect(refused.refusals).toHaveLength(SPAM)
    const small = run(BURST - THREE, OWNER, CallFamily.Other, 1, START, refused.state)
    expect(small.refusals).toEqual([])
  })
})

describe('call limits: hostile input', () => {
  it.each(NON_FINITE)('refuses a clock of %s without creating an owner', (now) => {
    const result = admitCall(EMPTY_CALL_LIMITS, OWNER, CallFamily.Other, SMALL, now)
    expect(result.refusal?.code).toBe(ContractErrorCode.RateLimited)
    expect(result.state.owners.size).toBe(0)
  })

  it.each([...NON_FINITE, POISON])('refuses a byte cost of %s and stays limited afterwards', (bytes) => {
    const poisoned = admitCall(EMPTY_CALL_LIMITS, OWNER, CallFamily.Other, bytes, START)
    expect(poisoned.refusal?.detail).toBe(LimitedBucket.Bytes)
    expect(run(BURST, OWNER, CallFamily.Other, SMALL, START, poisoned.state).refusals).toEqual([])
  })

  it('never mutates the shared empty state', () => {
    run(NOTIFICATION_BURST, OWNER, CallFamily.Other, SMALL, START)
    expect(EMPTY_CALL_LIMITS.owners.size).toBe(0)
  })

  it('updates one owner in constant time, without copying the table', () => {
    const first = run(MANY_OWNERS, 'seed', CallFamily.Other, 1, START).state
    const filled = Array.from({ length: MANY_OWNERS }).reduce<CallLimitsState>((state, _unused, index) => admitCall(state, `owner_${String(index)}`, CallFamily.Other, 1, START).state, first)
    expect(filled.owners.size).toBe(MANY_OWNERS + 1)
    expect(admitCall(filled, OWNER, CallFamily.Other, 1, START).state.owners).toBe(filled.owners)
    const started = Date.now()
    run(MANY_OWNERS, 'owner_1', CallFamily.Other, 1, START, filled)
    expect(Date.now() - started).toBeLessThan(TIME_BUDGET_MS)
  })
})
