import { describe, expect, it } from 'vitest'
import { admitReport, EMPTY_REPORT_LIMITS, forgetPlayer, PLAYER_REPORT_BUCKET, takeIgnoredSummary, type ReportLimits } from '../../../src/server/domain/report-limits'

const PLAN_CAPACITY = 40
const PLAN_REFILL_PER_SECOND = 20
const START = 50_000
const SECOND = 1000
const ALMOST_A_SECOND = 999
const PLAYER = 7
const OTHER_PLAYER = 12
const OVERFLOW = 3
const NON_FINITE_CLOCKS = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

interface Burst {
  readonly limits: ReportLimits
  readonly allowed: number
}

function burst(start: ReportLimits, player: number, count: number, now: number): Burst {
  let limits = start
  let allowed = 0
  for (let index = 0; index < count; index += 1) {
    const admission = admitReport(limits, player, now)
    limits = admission.limits
    if (admission.allowed) allowed += 1
  }
  return { limits, allowed }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) Object.values(value).forEach((child: unknown) => deepFreeze(child))
  return Object.freeze(value)
}

describe('report limits: bucket', () => {
  it('uses a burst of 40 and 20 per second', () => {
    expect(PLAYER_REPORT_BUCKET).toEqual({ capacity: PLAN_CAPACITY, refillPerSecond: PLAN_REFILL_PER_SECOND })
  })

  it('refuses the 41st report of a burst', () => {
    const drained = burst(EMPTY_REPORT_LIMITS, PLAYER, PLAN_CAPACITY, START)
    expect(drained.allowed).toBe(PLAN_CAPACITY)
    expect(admitReport(drained.limits, PLAYER, START).allowed).toBe(false)
  })

  it('keeps one bucket per player', () => {
    const drained = burst(EMPTY_REPORT_LIMITS, PLAYER, PLAN_CAPACITY, START)
    expect(burst(drained.limits, OTHER_PLAYER, PLAN_CAPACITY, START).allowed).toBe(PLAN_CAPACITY)
  })

  it('refills 20 reports per second', () => {
    const drained = burst(EMPTY_REPORT_LIMITS, PLAYER, PLAN_CAPACITY, START)
    expect(burst(drained.limits, PLAYER, PLAN_CAPACITY, START + SECOND).allowed).toBe(PLAN_REFILL_PER_SECOND)
  })

  it('does not mutate the limits it receives', () => {
    const frozen = deepFreeze(burst(EMPTY_REPORT_LIMITS, PLAYER, PLAN_CAPACITY + 1, START).limits)
    const snapshot = JSON.stringify(frozen)
    burst(frozen, PLAYER, OVERFLOW, START)
    takeIgnoredSummary(frozen, START + SECOND)
    forgetPlayer(frozen, PLAYER)
    expect(JSON.stringify(frozen)).toBe(snapshot)
  })

  it.each(NON_FINITE_CLOCKS)('refuses without storing anything when the clock reads %s', (clock) => {
    expect(admitReport(EMPTY_REPORT_LIMITS, PLAYER, clock)).toEqual({ limits: EMPTY_REPORT_LIMITS, allowed: false })
    const drained = burst(EMPTY_REPORT_LIMITS, PLAYER, PLAN_CAPACITY, START)
    const poisoned = admitReport(drained.limits, PLAYER, clock)
    expect(poisoned).toEqual({ limits: drained.limits, allowed: false })
    expect(admitReport(poisoned.limits, PLAYER, START).allowed).toBe(false)
  })
})

describe('report limits: ignored summary', () => {
  it('counts the ignored reports and resets the counter once summarized', () => {
    const drained = burst(EMPTY_REPORT_LIMITS, PLAYER, PLAN_CAPACITY + OVERFLOW, START)
    const taken = takeIgnoredSummary(drained.limits, START)
    expect(taken.summaries).toEqual([{ player: PLAYER, count: OVERFLOW }])
    expect(takeIgnoredSummary(taken.limits, START + SECOND).summaries).toEqual([])
  })

  it('summarizes every player in one pass', () => {
    const first = burst(EMPTY_REPORT_LIMITS, PLAYER, PLAN_CAPACITY + 1, START)
    const both = burst(first.limits, OTHER_PLAYER, PLAN_CAPACITY + OVERFLOW, START)
    expect(takeIgnoredSummary(both.limits, START).summaries).toEqual([{ player: PLAYER, count: 1 }, { player: OTHER_PLAYER, count: OVERFLOW }])
  })

  it('summarizes at most once per second', () => {
    const drained = burst(EMPTY_REPORT_LIMITS, PLAYER, PLAN_CAPACITY + 1, START)
    const first = takeIgnoredSummary(drained.limits, START)
    const again = burst(first.limits, PLAYER, OVERFLOW, START + 1)
    const tooSoon = takeIgnoredSummary(again.limits, START + ALMOST_A_SECOND)
    expect(tooSoon.summaries).toEqual([])
    expect(tooSoon.limits).toBe(again.limits)
    expect(takeIgnoredSummary(tooSoon.limits, START + SECOND).summaries).toEqual([{ player: PLAYER, count: OVERFLOW }])
  })

  it('summarizes nothing when the clock goes backwards or is not finite', () => {
    const drained = burst(EMPTY_REPORT_LIMITS, PLAYER, PLAN_CAPACITY + 1, START)
    const first = takeIgnoredSummary(drained.limits, START)
    const again = burst(first.limits, PLAYER, OVERFLOW, START)
    expect(takeIgnoredSummary(again.limits, START - SECOND).summaries).toEqual([])
    NON_FINITE_CLOCKS.forEach((clock) => expect(takeIgnoredSummary(again.limits, clock).summaries).toEqual([]))
  })
})

describe('report limits: forget', () => {
  it('removes the bucket and the counter of the player only', () => {
    const first = burst(EMPTY_REPORT_LIMITS, PLAYER, PLAN_CAPACITY + 1, START)
    const both = burst(first.limits, OTHER_PLAYER, PLAN_CAPACITY + 1, START)
    const forgotten = forgetPlayer(both.limits, PLAYER)
    expect(Object.keys(forgotten.buckets)).toEqual([String(OTHER_PLAYER)])
    expect(Object.keys(forgotten.ignored)).toEqual([String(OTHER_PLAYER)])
    expect(burst(forgotten, PLAYER, PLAN_CAPACITY, START).allowed).toBe(PLAN_CAPACITY)
    expect(admitReport(forgotten, OTHER_PLAYER, START).allowed).toBe(false)
  })
})
