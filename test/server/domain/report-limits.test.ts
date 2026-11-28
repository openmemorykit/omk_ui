import { describe, expect, it } from 'vitest'
import { PLAYER_REPORT_BUCKET } from '../../../src/shared/report/report-bucket'
import { admitPlayerReport, drainIgnored, IGNORED_SUMMARY_INTERVAL_MS, isSummaryDue, type PlayerReportState } from '../../../src/server/domain/report-limits'

const PLAN_CAPACITY = 40
const PLAN_REFILL_PER_SECOND = 20
const START = 50_000
const SECOND = 1000
const ALMOST_A_SECOND = 999
const OVERFLOW = 3
const NON_FINITE_CLOCKS = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

interface Burst {
  readonly state: PlayerReportState | undefined
  readonly allowed: number
}

function burst(start: PlayerReportState | undefined, count: number, now: number): Burst {
  let state = start
  let allowed = 0
  for (let index = 0; index < count; index += 1) {
    const admission = admitPlayerReport(state, now)
    state = admission.state
    if (admission.allowed) allowed += 1
  }
  return { state, allowed }
}

function definedState(state: PlayerReportState | undefined): PlayerReportState {
  if (state === undefined) throw new Error('state expected')
  return state
}

describe('report limits: player bucket', () => {
  it('uses a burst of 40 and 20 per second', () => {
    expect(PLAYER_REPORT_BUCKET).toEqual({ capacity: PLAN_CAPACITY, refillPerSecond: PLAN_REFILL_PER_SECOND })
    expect(IGNORED_SUMMARY_INTERVAL_MS).toBe(SECOND)
  })

  it('starts a new player with a full bucket', () => {
    const admission = admitPlayerReport(undefined, START)
    expect(admission.allowed).toBe(true)
    expect(admission.state).toEqual({ bucket: { tokens: PLAN_CAPACITY - 1, refilledAt: START }, ignored: 0 })
  })

  it('refuses the 41st report of a burst and counts the ignored ones', () => {
    const drained = burst(undefined, PLAN_CAPACITY + OVERFLOW, START)
    expect(drained.allowed).toBe(PLAN_CAPACITY)
    expect(drained.state?.ignored).toBe(OVERFLOW)
  })

  it('refills 20 reports per second', () => {
    const drained = burst(undefined, PLAN_CAPACITY, START)
    expect(burst(drained.state, PLAN_CAPACITY, START + SECOND).allowed).toBe(PLAN_REFILL_PER_SECOND)
  })

  it('does not mutate the state it receives', () => {
    const state = definedState(burst(undefined, PLAN_CAPACITY + 1, START).state)
    const frozen = Object.freeze({ bucket: Object.freeze({ ...state.bucket }), ignored: state.ignored })
    const before = JSON.stringify(frozen)
    burst(frozen, OVERFLOW, START)
    drainIgnored(frozen)
    expect(JSON.stringify(frozen)).toBe(before)
  })

  it.each(NON_FINITE_CLOCKS)('refuses and stores nothing when the clock reads %s', (clock) => {
    expect(admitPlayerReport(undefined, clock)).toEqual({ state: undefined, allowed: false })
    const drained = burst(undefined, PLAN_CAPACITY, START).state
    const poisoned = admitPlayerReport(drained, clock)
    expect(poisoned).toEqual({ state: drained, allowed: false })
    expect(admitPlayerReport(poisoned.state, START).allowed).toBe(false)
  })
})

describe('report limits: ignored summary', () => {
  it('drains the ignored counter', () => {
    const state = definedState(burst(undefined, PLAN_CAPACITY + OVERFLOW, START).state)
    const drained = drainIgnored(state)
    expect(drained.count).toBe(OVERFLOW)
    expect(drained.state).toEqual({ ...state, ignored: 0 })
  })

  it('is due once a second has passed, never on a clock that is not finite or goes backwards', () => {
    expect(isSummaryDue(Number.NEGATIVE_INFINITY, START)).toBe(true)
    expect(isSummaryDue(START, START + SECOND)).toBe(true)
    expect(isSummaryDue(START, START + ALMOST_A_SECOND)).toBe(false)
    expect(isSummaryDue(START, START - SECOND)).toBe(false)
    NON_FINITE_CLOCKS.forEach((clock) => expect(isSummaryDue(START, clock)).toBe(false))
  })
})
