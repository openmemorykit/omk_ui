import { describe, expect, it } from 'vitest'
import { BACK_HOLD_MS, checkBackHold, pressBack, RELEASED_BACK } from '../../../src/page/domain/hold-detector'

const START = 5000
const LONG_WAIT_MS = 1000
const VERY_LONG_WAIT_MS = 10000
const SECOND_PRESS_OFFSET_MS = 2000

describe('back hold detector', () => {
  it('does not fire before the hold duration', () => {
    const result = checkBackHold(pressBack(START), START + BACK_HOLD_MS - 1)
    expect(result.fired).toBe(false)
    expect(result.hold).toEqual({ pressedAt: START, fired: false })
  })

  it('fires once at the hold duration', () => {
    const first = checkBackHold(pressBack(START), START + BACK_HOLD_MS)
    expect(first.fired).toBe(true)
    expect(first.hold.fired).toBe(true)
    expect(checkBackHold(first.hold, START + BACK_HOLD_MS + LONG_WAIT_MS).fired).toBe(false)
  })

  it('does nothing when released', () => {
    expect(checkBackHold(RELEASED_BACK, START + VERY_LONG_WAIT_MS)).toEqual({ hold: RELEASED_BACK, fired: false })
  })

  it('fires again after a new press', () => {
    const fired = checkBackHold(pressBack(START), START + BACK_HOLD_MS).hold
    expect(fired.fired).toBe(true)
    expect(checkBackHold(pressBack(START + SECOND_PRESS_OFFSET_MS), START + SECOND_PRESS_OFFSET_MS + BACK_HOLD_MS).fired).toBe(true)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('never fires on a non finite clock (%s)', (now) => {
    expect(checkBackHold(pressBack(START), now).fired).toBe(false)
    expect(pressBack(now)).toEqual(RELEASED_BACK)
  })

  it('never fires when the clock goes backwards', () => {
    expect(checkBackHold(pressBack(START), START - VERY_LONG_WAIT_MS).fired).toBe(false)
  })
})
