import { describe, expect, it } from 'vitest'
import { Intent, IntentPhase } from '../../../src/protocol/intents'
import type { StickEvent } from '../../../src/protocol/intents'
import { comparePadSnapshot, PadControl, primePadSnapshot } from '../../../src/client/domain/pad-snapshot'
import { GAMEPAD_CLOSED, GAMEPAD_RADIAL, KEYBOARD, NEUTRAL, pad, reading, run } from './pad-helpers'

const OUT_OF_RANGE = 5

describe('hostile stick values', () => {
  const hostile: readonly number[] = [NaN, Infinity, -Infinity, OUT_OF_RANGE, -OUT_OF_RANGE, Number.MAX_VALUE, -0, Number.MIN_VALUE]

  function assertConsistent(stick: StickEvent | null): void {
    if (stick === null) return
    expect(Number.isFinite(stick.x) && Number.isFinite(stick.y)).toBe(true)
    expect(Math.abs(stick.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(stick.y)).toBeLessThanOrEqual(1)
    expect(Object.is(stick.x, -0) || Object.is(stick.y, -0)).toBe(false)
  }

  it('never throws and always yields finite vectors within [-1, 1], radial open or closed', () => {
    hostile.forEach((x) => {
      hostile.forEach((y) => {
        const stick = { x, y }
        const primed = primePadSnapshot(reading([], stick))
        ;[GAMEPAD_RADIAL, GAMEPAD_CLOSED, KEYBOARD].forEach((context) => {
          const comparison = comparePadSnapshot(primed, reading([PadControl.FrontendUp], stick), context)
          assertConsistent(comparison.stick)
          assertConsistent(comparison.state.lastSentStick)
        })
      })
    })
  })

  it('clamps an infinite deflection to the unit square', () => {
    const result = run(GAMEPAD_RADIAL, [reading([], { x: Infinity, y: -Infinity })])
    expect(result.sticks).toEqual([{ x: 1, y: -1 }])
  })

  it('treats non numeric components as zero', () => {
    const stick = { x: undefined, y: 0.9 } as unknown as StickEvent
    expect(run(GAMEPAD_RADIAL, [reading([], stick)]).sticks).toEqual([{ x: 0, y: 0.9 }])
  })

  it('treats NaN as a neutral stick', () => {
    const result = run(GAMEPAD_RADIAL, [reading([], { x: NaN, y: NaN })])
    expect(result.sticks).toEqual([null])
    expect(result.state.lastSentStick).toEqual(NEUTRAL)
  })

  it('presses a direction for an infinite deflection, once', () => {
    const frame = reading([], { x: Infinity, y: NaN })
    expect(run(GAMEPAD_CLOSED, [frame, frame]).intents).toEqual([pad(Intent.Right, IntentPhase.Press)])
  })

  it('never produces a state with non finite values after a hostile frame', () => {
    const result = run(GAMEPAD_RADIAL, [
      reading([], { x: NaN, y: Infinity }),
      reading([], { x: 0.3, y: 0.3 }),
      reading([], { x: -Infinity, y: NaN }),
    ])
    assertConsistent(result.state.lastSentStick)
    expect(result.sticks.map((stick) => stick !== null)).toEqual([true, true, true])
  })
})
