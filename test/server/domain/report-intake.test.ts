import { describe, expect, it } from 'vitest'
import { ReportIntake } from '../../../src/server/domain/report-intake'

const PLAN_CAPACITY = 40
const PLAN_REFILL_PER_SECOND = 20
const START = 50_000
const SECOND = 1000
const ALMOST_A_SECOND = 999
const PLAYER = 7
const OTHER_PLAYER = 12
const OVERFLOW = 3
const MAX_PLAYERS = 2048
const FLOOD_EVENTS = 100_000
const FLOOD_BUDGET_MS = 300
const NON_FINITE_CLOCKS = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

function admitMany(intake: ReportIntake, player: number, count: number, now: number): number {
  let allowed = 0
  for (let index = 0; index < count; index += 1) {
    if (intake.admit(player, now)) allowed += 1
  }
  return allowed
}

function populated(): ReportIntake {
  const intake = new ReportIntake()
  for (let player = 1; player <= MAX_PLAYERS; player += 1) intake.admit(player, START)
  return intake
}

describe('report intake: admission', () => {
  it('refuses the 41st report of a burst', () => {
    const intake = new ReportIntake()
    expect(admitMany(intake, PLAYER, PLAN_CAPACITY, START)).toBe(PLAN_CAPACITY)
    expect(intake.admit(PLAYER, START)).toBe(false)
  })

  it('keeps one bucket per player and refills 20 per second', () => {
    const intake = new ReportIntake()
    admitMany(intake, PLAYER, PLAN_CAPACITY, START)
    expect(admitMany(intake, OTHER_PLAYER, PLAN_CAPACITY, START)).toBe(PLAN_CAPACITY)
    expect(admitMany(intake, PLAYER, PLAN_CAPACITY, START + SECOND)).toBe(PLAN_REFILL_PER_SECOND)
  })

  it.each(NON_FINITE_CLOCKS)('refuses on a clock reading %s and stays limited afterwards', (clock) => {
    const intake = new ReportIntake()
    expect(intake.admit(PLAYER, clock)).toBe(false)
    expect(admitMany(intake, PLAYER, PLAN_CAPACITY + 1, START)).toBe(PLAN_CAPACITY)
    expect(intake.admit(PLAYER, clock)).toBe(false)
    expect(intake.admit(PLAYER, START)).toBe(false)
    expect(intake.takeIgnoredSummary(START)).toEqual([{ player: PLAYER, count: 2 }])
  })

  it('admits each event of a flooding player in constant time, with 2 048 players known', () => {
    admitMany(populated(), 1, FLOOD_EVENTS, START)
    const intake = populated()
    const begin = Date.now()
    admitMany(intake, 1, FLOOD_EVENTS, START)
    expect(Date.now() - begin).toBeLessThan(FLOOD_BUDGET_MS)
  })
})

describe('report intake: ignored summary', () => {
  it('summarizes every player in one pass and resets the counters', () => {
    const intake = new ReportIntake()
    admitMany(intake, PLAYER, PLAN_CAPACITY + 1, START)
    admitMany(intake, OTHER_PLAYER, PLAN_CAPACITY + OVERFLOW, START)
    expect(intake.takeIgnoredSummary(START)).toEqual([{ player: PLAYER, count: 1 }, { player: OTHER_PLAYER, count: OVERFLOW }])
    expect(intake.takeIgnoredSummary(START + SECOND)).toEqual([])
  })

  it('summarizes at most once per second', () => {
    const intake = new ReportIntake()
    admitMany(intake, PLAYER, PLAN_CAPACITY + 1, START)
    intake.takeIgnoredSummary(START)
    admitMany(intake, PLAYER, OVERFLOW, START + 1)
    expect(intake.takeIgnoredSummary(START + ALMOST_A_SECOND)).toEqual([])
    expect(intake.takeIgnoredSummary(START + SECOND)).toEqual([{ player: PLAYER, count: OVERFLOW }])
  })

  it('summarizes right away a refusal that follows an empty pass', () => {
    const intake = new ReportIntake()
    admitMany(intake, PLAYER, PLAN_CAPACITY, START)
    expect(intake.takeIgnoredSummary(START)).toEqual([])
    intake.admit(PLAYER, START + 1)
    expect(intake.takeIgnoredSummary(START + 1)).toEqual([{ player: PLAYER, count: 1 }])
  })

  it('summarizes nothing when the clock goes backwards or is not finite', () => {
    const intake = new ReportIntake()
    admitMany(intake, PLAYER, PLAN_CAPACITY + 1, START)
    intake.takeIgnoredSummary(START)
    admitMany(intake, PLAYER, OVERFLOW, START)
    expect(intake.takeIgnoredSummary(START - SECOND)).toEqual([])
    NON_FINITE_CLOCKS.forEach((clock) => expect(intake.takeIgnoredSummary(clock)).toEqual([]))
  })
})

describe('report intake: forget', () => {
  it('removes the bucket and the counter of the player only', () => {
    const intake = new ReportIntake()
    admitMany(intake, PLAYER, PLAN_CAPACITY + 1, START)
    admitMany(intake, OTHER_PLAYER, PLAN_CAPACITY + 1, START)
    intake.forget(PLAYER)
    expect(admitMany(intake, PLAYER, PLAN_CAPACITY, START)).toBe(PLAN_CAPACITY)
    expect(intake.admit(OTHER_PLAYER, START)).toBe(false)
    expect(intake.takeIgnoredSummary(START)).toEqual([{ player: OTHER_PLAYER, count: 2 }])
  })
})
