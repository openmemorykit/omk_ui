import { describe, expect, it } from 'vitest'
import { Intent } from '../../../src/protocol/intents'
import { dueRepeats, nextRepeatAt, pressHeld, releaseHeld, REPEAT_DELAY_MS, REPEAT_INTERVAL_MS, REPEAT_MAX_PER_CALL, REPEAT_SAFETY_MS } from '../../../src/page/domain/repeat-policy'
import type { HeldIntents } from '../../../src/page/domain/repeat-policy'

const START = 1000
const SHORT_OFFSET_MS = 50
const SECOND_PRESS_OFFSET_MS = 100
const MEDIUM_OFFSET_MS = 1000
const LONG_OFFSET_MS = 5000
const DIRECTION_COUNT = 4
const NONE: HeldIntents = []
const heldDown = pressHeld(NONE, Intent.Down, START)

describe('repeat policy', () => {
  it('repeats directions only', () => {
    expect(pressHeld(NONE, Intent.Confirm, START)).toEqual([])
    expect(pressHeld(NONE, Intent.Back, START)).toEqual([])
    expect(heldDown).toEqual([{ intent: Intent.Down, pressedAt: START, nextRepeatAt: START + REPEAT_DELAY_MS }])
  })

  it('ignores a second press of a held direction', () => {
    expect(pressHeld(heldDown, Intent.Down, START + SHORT_OFFSET_MS)).toBe(heldDown)
  })

  it('emits nothing before the first delay', () => {
    const result = dueRepeats(heldDown, START + REPEAT_DELAY_MS - 1)
    expect(result.repeats).toEqual([])
    expect(result.held).toEqual(heldDown)
  })

  it('emits the first repeat at the delay then every interval', () => {
    const first = dueRepeats(heldDown, START + REPEAT_DELAY_MS)
    expect(first.repeats).toEqual([Intent.Down])
    expect(nextRepeatAt(first.held)).toBe(START + REPEAT_DELAY_MS + REPEAT_INTERVAL_MS)
    expect(dueRepeats(first.held, START + REPEAT_DELAY_MS + REPEAT_INTERVAL_MS - 1).repeats).toEqual([])
    const second = dueRepeats(first.held, START + REPEAT_DELAY_MS + REPEAT_INTERVAL_MS)
    expect(second.repeats).toEqual([Intent.Down])
  })

  it('stops at release', () => {
    const released = releaseHeld(heldDown, Intent.Down)
    expect(released).toEqual([])
    expect(dueRepeats(released, START + LONG_OFFSET_MS).repeats).toEqual([])
    expect(nextRepeatAt(released)).toBeNull()
  })

  it('does not mutate its input', () => {
    const snapshot = JSON.stringify(heldDown)
    dueRepeats(heldDown, START + MEDIUM_OFFSET_MS)
    releaseHeld(heldDown, Intent.Down)
    expect(JSON.stringify(heldDown)).toBe(snapshot)
  })

  it('stops at the safety limit', () => {
    const result = dueRepeats(heldDown, START + REPEAT_SAFETY_MS)
    expect(result.stopped).toEqual([Intent.Down])
    expect(result.repeats).toEqual([])
    expect(result.held).toEqual([])
  })

  it('tracks several directions and reports the earliest next repeat', () => {
    const both = pressHeld(heldDown, Intent.Left, START + SECOND_PRESS_OFFSET_MS)
    expect(nextRepeatAt(both)).toBe(START + REPEAT_DELAY_MS)
    expect(dueRepeats(both, START + SECOND_PRESS_OFFSET_MS + REPEAT_DELAY_MS).repeats).toEqual([Intent.Down, Intent.Down, Intent.Left])
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('never repeats on a non finite clock (%s)', (now) => {
    expect(dueRepeats(heldDown, now)).toEqual({ held: heldDown, repeats: [], stopped: [] })
    expect(pressHeld(NONE, Intent.Up, now)).toEqual([])
  })

  it('never repeats when the clock goes backwards', () => {
    const result = dueRepeats(heldDown, START - LONG_OFFSET_MS)
    expect(result.repeats).toEqual([])
    expect(result.stopped).toEqual([])
    expect(result.held).toEqual(heldDown)
  })

  it('bounds the burst after a large jump below the safety limit', () => {
    const result = dueRepeats(heldDown, START + REPEAT_SAFETY_MS - 1)
    expect(result.repeats.length).toBe(REPEAT_MAX_PER_CALL)
    const next = nextRepeatAt(result.held)
    expect(next).toBe(START + REPEAT_SAFETY_MS - 1 + REPEAT_INTERVAL_MS)
    expect(dueRepeats(result.held, START + REPEAT_SAFETY_MS - 1).repeats).toEqual([])
  })

  it('emits no burst after a huge jump', () => {
    const result = dueRepeats(heldDown, START + Number.MAX_SAFE_INTEGER)
    expect(result.repeats).toEqual([])
    expect(result.stopped).toEqual([Intent.Down])
  })

  it('bounds repeats per call for every held direction', () => {
    const all = [Intent.Up, Intent.Down, Intent.Left, Intent.Right].reduce(
      (held, intent) => pressHeld(held, intent, START),
      NONE,
    )
    const result = dueRepeats(all, START + REPEAT_SAFETY_MS - 1)
    expect(result.repeats.length).toBe(REPEAT_MAX_PER_CALL * DIRECTION_COUNT)
  })
})
