import { describe, expect, it } from 'vitest'
import {
  GuardEnd,
  GuardedControl,
  GuardSignal,
  guardedControls,
  NO_GUARD,
  PAD_GUARDED_CONTROLS,
  RELEASE_GUARD_CAP_MS,
  startEscapeGuard,
  startPadGuard,
  stepReleaseGuard,
} from '../../../src/client/domain/release-guard'
import type { GuardInput, ReleaseGuard } from '../../../src/client/domain/release-guard'

const START = 1000
const CLOSING = GuardedControl.FrontendCancel
const SHORT = 10
const HALF_WAY = 500
const STEP = 100
const MALFORMED_NUMBER = 7
const frame = (now: number, closingControlHeld: boolean): GuardInput => ({ signal: GuardSignal.Frame, now, closingControlHeld })
const ESCAPE_RELEASED: GuardInput = { signal: GuardSignal.EscapeReleased }
const BLURRED: GuardInput = { signal: GuardSignal.PageBlurred }

describe('pad guard', () => {
  const guard = startPadGuard(CLOSING, START)

  it('keeps guarding while the control is held', () => {
    expect(stepReleaseGuard(guard, frame(START + SHORT, true))).toEqual({ guard, ended: null })
  })

  it('ends on release', () => {
    expect(stepReleaseGuard(guard, frame(START + SHORT, false))).toEqual({ guard: NO_GUARD, ended: GuardEnd.Released })
  })

  it('ends at the cap even when still held', () => {
    expect(stepReleaseGuard(guard, frame(START + RELEASE_GUARD_CAP_MS - 1, true)).ended).toBeNull()
    expect(stepReleaseGuard(guard, frame(START + RELEASE_GUARD_CAP_MS, true))).toEqual({ guard: NO_GUARD, ended: GuardEnd.Capped })
  })

  it('ignores the escape release', () => {
    expect(stepReleaseGuard(guard, ESCAPE_RELEASED)).toEqual({ guard, ended: null })
  })

  it('lists the guarded controls, plus 0 when View closed', () => {
    expect(guardedControls(guard)).toEqual(Object.values(GuardedControl))
    expect(guardedControls(startPadGuard(0, START))).toEqual([...PAD_GUARDED_CONTROLS, 0])
  })

  it('ignores the page blur so the closing key stays guarded', () => {
    expect(stepReleaseGuard(guard, BLURRED)).toEqual({ guard, ended: null })
  })
})

describe('escape guard', () => {
  const guard = startEscapeGuard(START)

  it('keeps guarding on frames before the cap', () => {
    expect(stepReleaseGuard(guard, frame(START + HALF_WAY, true))).toEqual({ guard, ended: null })
    expect(stepReleaseGuard(guard, frame(START + HALF_WAY, false))).toEqual({ guard, ended: null })
  })

  it.each([
    ['escape release', ESCAPE_RELEASED, GuardEnd.EscapeReleased],
    ['page blur', BLURRED, GuardEnd.Blurred],
    ['cap', frame(START + RELEASE_GUARD_CAP_MS, true), GuardEnd.Capped],
  ])('ends on %s', (_name, input, ended) => {
    expect(stepReleaseGuard(guard, input)).toEqual({ guard: NO_GUARD, ended })
  })

  it('guards no pad control', () => {
    expect(guardedControls(guard)).toEqual([])
  })
})

describe('no guard', () => {
  it.each([ESCAPE_RELEASED, BLURRED, frame(START, true)])('does nothing', (input) => {
    expect(stepReleaseGuard(NO_GUARD, input)).toEqual({ guard: NO_GUARD, ended: null })
  })

  it('guards nothing', () => {
    expect(guardedControls(NO_GUARD)).toEqual([])
  })
})

describe('failing safe', () => {
  const NON_FINITE = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

  it.each(NON_FINITE)('releases a pad guard when the clock reads %s', (now) => {
    expect(stepReleaseGuard(startPadGuard(CLOSING, START), frame(now, true))).toEqual({ guard: NO_GUARD, ended: GuardEnd.Capped })
  })

  it.each(NON_FINITE)('releases an escape guard when the clock reads %s', (now) => {
    expect(stepReleaseGuard(startEscapeGuard(START), frame(now, false))).toEqual({ guard: NO_GUARD, ended: GuardEnd.Capped })
  })

  it.each(NON_FINITE)('releases a guard started with the clock at %s', (startedAt) => {
    expect(stepReleaseGuard(startPadGuard(CLOSING, startedAt), frame(START, true)).ended).toBe(GuardEnd.Capped)
    expect(stepReleaseGuard(startEscapeGuard(startedAt), frame(START, true)).ended).toBe(GuardEnd.Capped)
  })

  it('releases when the clock goes backwards', () => {
    expect(stepReleaseGuard(startPadGuard(CLOSING, START), frame(START - 1, true)).ended).toBe(GuardEnd.Capped)
    expect(stepReleaseGuard(startEscapeGuard(START), frame(START - 1, false)).ended).toBe(GuardEnd.Capped)
  })

  it('releases on an unknown guard kind', () => {
    const unknown = { kind: 'mystery', startedAt: START } as unknown as ReleaseGuard
    expect(stepReleaseGuard(unknown, frame(START, true))).toEqual({ guard: NO_GUARD, ended: GuardEnd.Capped })
    expect(guardedControls(unknown)).toEqual([])
  })

  it.each([null, undefined, 'pad', MALFORMED_NUMBER])('releases on a malformed guard %s', (value) => {
    const malformed = value as unknown as ReleaseGuard
    expect(stepReleaseGuard(malformed, frame(START, true)).guard).toBe(NO_GUARD)
    expect(guardedControls(malformed)).toEqual([])
  })

  it.each([null, undefined, { signal: 'mystery' }])('releases on a malformed input %j', (value) => {
    const input = value as unknown as GuardInput
    expect(stepReleaseGuard(startPadGuard(CLOSING, START), input)).toEqual({ guard: NO_GUARD, ended: GuardEnd.Capped })
    expect(stepReleaseGuard(startEscapeGuard(START), input)).toEqual({ guard: NO_GUARD, ended: GuardEnd.Capped })
  })

  it('reads an unknown signal with a valid clock as a release, never as a frame', () => {
    const unknown = { signal: 'mystery', now: START, closingControlHeld: false } as unknown as GuardInput
    expect(stepReleaseGuard(startPadGuard(CLOSING, START), unknown)).toEqual({ guard: NO_GUARD, ended: GuardEnd.Capped })
    expect(stepReleaseGuard(startEscapeGuard(START), unknown)).toEqual({ guard: NO_GUARD, ended: GuardEnd.Capped })
  })

  it('reports no end when there is no guard to release', () => {
    expect(stepReleaseGuard(NO_GUARD, null as unknown as GuardInput)).toEqual({ guard: NO_GUARD, ended: null })
  })

  it('never holds a guard beyond the cap whatever the frames say', () => {
    let guard: ReleaseGuard = startPadGuard(CLOSING, START)
    for (let now = START; now <= START + RELEASE_GUARD_CAP_MS; now += STEP) guard = stepReleaseGuard(guard, frame(now, true)).guard
    expect(guard).toBe(NO_GUARD)
  })
})
