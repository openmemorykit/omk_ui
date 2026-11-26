import { describe, expect, it } from 'vitest'
import { Intent, IntentPhase } from '../../../src/protocol/intents'
import type { StickEvent } from '../../../src/protocol/intents'
import {
  comparePadSnapshot,
  PAD_INTENTS,
  PadControl,
  primePadSnapshot,
  STICK_AS_DPAD_PRESS,
  STICK_AS_DPAD_RELEASE,
  STICK_CHANGE_THRESHOLD,
  STICK_DEADZONE,
} from '../../../src/client/domain/pad-snapshot'
import type { PadReading } from '../../../src/client/domain/pad-snapshot'
import { GAMEPAD_CLOSED, GAMEPAD_RADIAL, KEYBOARD, NEUTRAL, pad, reading, run } from './pad-helpers'

const PINNED_DEADZONE = 0.2
const PINNED_CHANGE = 0.02
const PINNED_PRESS = 0.6
const PINNED_RELEASE = 0.4
const CONTROL_COUNT = 12
const UNKNOWN_CONTROL = 9999
const OUT_OF_RANGE = 5



describe('PAD_INTENTS', () => {
  it('lists the 12 controls once each with the intents of the table', () => {
    expect(PAD_INTENTS).toHaveLength(CONTROL_COUNT)
    expect(new Set(PAD_INTENTS.map(([control]) => control)).size).toBe(CONTROL_COUNT)
    expect(Object.fromEntries(PAD_INTENTS)).toEqual({
      [PadControl.FrontendUp]: Intent.Up,
      [PadControl.FrontendDown]: Intent.Down,
      [PadControl.FrontendLeft]: Intent.Left,
      [PadControl.FrontendRight]: Intent.Right,
      [PadControl.FrontendAccept]: Intent.Confirm,
      [PadControl.FrontendCancel]: Intent.Back,
      [PadControl.FrontendLb]: Intent.TabPrev,
      [PadControl.FrontendRb]: Intent.TabNext,
      [PadControl.FrontendX]: Intent.Erase,
      [PadControl.FrontendY]: Intent.Space,
      [PadControl.FrontendPause]: Intent.Submit,
      [PadControl.NextCamera]: Intent.Radial,
    })
  })

  it('pins the control indices and thresholds', () => {
    expect(PadControl).toEqual({
      NextCamera: 0, FrontendDown: 187, FrontendUp: 188, FrontendLeft: 189, FrontendRight: 190,
      FrontendAxisX: 195, FrontendAxisY: 196, FrontendPause: 199, FrontendAccept: 201, FrontendCancel: 202,
      FrontendX: 203, FrontendY: 204, FrontendLb: 205, FrontendRb: 206,
    })
    expect(STICK_DEADZONE).toBe(PINNED_DEADZONE)
    expect(STICK_CHANGE_THRESHOLD).toBe(PINNED_CHANGE)
    expect(STICK_AS_DPAD_PRESS).toBe(PINNED_PRESS)
    expect(STICK_AS_DPAD_RELEASE).toBe(PINNED_RELEASE)
  })
})

describe('buttons', () => {
  it('emits one press when held two frames, then one release', () => {
    const held = reading([PadControl.FrontendAccept])
    const result = run(GAMEPAD_CLOSED, [held, held, reading([])])
    expect(result.intents).toEqual([pad(Intent.Confirm, IntentPhase.Press), pad(Intent.Confirm, IntentPhase.Release)])
  })

  it('maps each control to its intent', () => {
    PAD_INTENTS.forEach(([control, intent]) => {
      const result = run(GAMEPAD_CLOSED, [reading([control])])
      expect(result.intents).toEqual([pad(intent, IntentPhase.Press)])
    })
  })

  it('does not press radial when Back is already held at priming', () => {
    const held = reading([PadControl.NextCamera])
    const result = run(GAMEPAD_RADIAL, [held, held], primePadSnapshot(held))
    expect(result.intents).toEqual([])
    const released = run(GAMEPAD_RADIAL, [reading([])], primePadSnapshot(held))
    expect(released.intents).toEqual([pad(Intent.Radial, IntentPhase.Release)])
  })

  it('ignores controls that are not buttons', () => {
    const odd = reading([PadControl.FrontendAxisX, UNKNOWN_CONTROL as PadControl])
    expect(run(GAMEPAD_CLOSED, [odd]).intents).toEqual([])
    expect(primePadSnapshot(odd).held.size).toBe(0)
  })

  it('does not mutate its inputs', () => {
    const held = new Set<PadControl>([PadControl.FrontendUp])
    const input: PadReading = Object.freeze({ held, stick: Object.freeze({ x: 0.9, y: 0 }) })
    const state = primePadSnapshot(reading([]))
    comparePadSnapshot(state, input, GAMEPAD_CLOSED)
    expect([...held]).toEqual([PadControl.FrontendUp])
    expect(state.held.size).toBe(0)
  })
})

describe('keyboard modality', () => {
  it('produces no intent and no vector, and re-primes without a later spurious press', () => {
    const held = reading([PadControl.FrontendAccept], { x: 0.9, y: 0.9 })
    const first = comparePadSnapshot(primePadSnapshot(reading([])), held, KEYBOARD)
    expect(first.intents).toEqual([])
    expect(first.stick).toBeNull()
    const back = comparePadSnapshot(first.state, held, GAMEPAD_CLOSED)
    expect(back.intents).toEqual([])
  })
})

describe('radial open: vector', () => {
  it('sends when a component moves by more than 0.02', () => {
    const result = run(GAMEPAD_RADIAL, [
      reading([], { x: 0.5, y: 0 }),
      reading([], { x: 0.51, y: 0 }),
      reading([], { x: 0.53, y: 0 }),
      reading([], { x: 0.53, y: -0.05 }),
      reading([], { x: 0.53, y: -0.05 }),
    ])
    expect(result.sticks).toEqual([{ x: 0.5, y: 0 }, null, { x: 0.53, y: 0 }, { x: 0.53, y: -0.05 }, null])
  })

  it('compares with the last vector sent, not the last frame', () => {
    const result = run(GAMEPAD_RADIAL, [
      reading([], { x: 0.5, y: 0 }),
      reading([], { x: 0.515, y: 0 }),
      reading([], { x: 0.53, y: 0 }),
    ])
    expect(result.sticks).toEqual([{ x: 0.5, y: 0 }, null, { x: 0.53, y: 0 }])
  })

  it('sends a single null vector when back under the deadzone', () => {
    const result = run(GAMEPAD_RADIAL, [
      reading([], { x: 0.7, y: 0 }),
      reading([], { x: 0.1, y: 0.1 }),
      reading([], { x: 0.05, y: 0 }),
      reading([], NEUTRAL),
    ])
    expect(result.sticks).toEqual([{ x: 0.7, y: 0 }, NEUTRAL, null, null])
  })

  it('sends nothing for a stick that stays inside the deadzone', () => {
    const result = run(GAMEPAD_RADIAL, [reading([], { x: 0.1, y: 0.1 }), reading([], { x: -0.15, y: 0 })])
    expect(result.sticks).toEqual([null, null])
  })

  it('sends a deflection held since priming', () => {
    const held = reading([], { x: 0.8, y: 0 })
    const result = run(GAMEPAD_RADIAL, [held], primePadSnapshot(held))
    expect(result.sticks).toEqual([{ x: 0.8, y: 0 }])
  })

  it('emits no direction intent while the radial is open', () => {
    const result = run(GAMEPAD_RADIAL, [reading([], { x: 0.9, y: 0 })])
    expect(result.intents).toEqual([])
  })

  it('releases a stick direction pressed before the radial opened', () => {
    const pressed = run(GAMEPAD_CLOSED, [reading([], { x: 0, y: -0.9 })])
    const opened = comparePadSnapshot(pressed.state, reading([], { x: 0, y: -0.9 }), GAMEPAD_RADIAL)
    expect(opened.intents).toEqual([pad(Intent.Up, IntentPhase.Release)])
  })
})

describe('radial closed: stick as a cross', () => {
  const frames = (...sticks: readonly StickEvent[]): readonly PadReading[] => sticks.map((stick) => reading([], stick))

  it('presses at 0.6, releases under 0.4, nothing in between, no vector', () => {
    const result = run(
      GAMEPAD_CLOSED,
      frames({ x: 0.5, y: 0 }, { x: 0.6, y: 0 }, { x: 0.5, y: 0 }, { x: 0.4, y: 0 }, { x: 0.39, y: 0 }, { x: 0.5, y: 0 }),
    )
    expect(result.intents).toEqual([pad(Intent.Right, IntentPhase.Press), pad(Intent.Right, IntentPhase.Release)])
    expect(result.sticks.every((stick) => stick === null)).toBe(true)
  })

  it('maps y negative to up and positive to down, x negative to left', () => {
    const upIntents = run(GAMEPAD_CLOSED, frames({ x: 0, y: -0.9 })).intents
    const downIntents = run(GAMEPAD_CLOSED, frames({ x: 0, y: 0.9 })).intents
    const leftIntents = run(GAMEPAD_CLOSED, frames({ x: -0.9, y: 0 })).intents
    expect([upIntents, downIntents, leftIntents]).toEqual([
      [pad(Intent.Up, IntentPhase.Press)],
      [pad(Intent.Down, IntentPhase.Press)],
      [pad(Intent.Left, IntentPhase.Press)],
    ])
  })

  it('keeps a single direction on a diagonal, the dominant axis', () => {
    const result = run(GAMEPAD_CLOSED, frames({ x: 0.7, y: -0.8 }))
    expect(result.intents).toEqual([pad(Intent.Up, IntentPhase.Press)])
  })

  it('does not press for a stick held since priming', () => {
    const held = reading([], { x: 0.9, y: 0 })
    expect(run(GAMEPAD_CLOSED, [held], primePadSnapshot(held)).intents).toEqual([])
  })
})

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
