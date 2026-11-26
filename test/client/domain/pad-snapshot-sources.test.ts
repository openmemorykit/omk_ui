import { describe, expect, it } from 'vitest'
import { Intent, IntentPhase } from '../../../src/protocol/intents'
import { PadControl } from '../../../src/client/domain/pad-snapshot'
import { GAMEPAD_CLOSED, GAMEPAD_RADIAL, NEUTRAL, pad, reading, run } from './pad-helpers'

describe('radial closing with the stick still deflected', () => {
  const aimed = reading([], { x: 0, y: -0.9 })
  const confirmed = reading([PadControl.FrontendAccept], { x: 0, y: -0.9 })

  it('does not press the direction again, then presses after a return to centre', () => {
    const opened = run(GAMEPAD_CLOSED, [reading([], NEUTRAL)])
    const aiming = run(GAMEPAD_RADIAL, [aimed, confirmed], opened.state)
    const closed = run(GAMEPAD_CLOSED, [aimed, aimed], aiming.state)
    expect(aiming.intents).toEqual([pad(Intent.Confirm, IntentPhase.Press)])
    expect(closed.intents).toEqual([pad(Intent.Confirm, IntentPhase.Release)])
    const centred = run(GAMEPAD_CLOSED, [reading([], NEUTRAL)], closed.state)
    expect(centred.intents).toEqual([])
    const again = run(GAMEPAD_CLOSED, [aimed, aimed], centred.state)
    expect(again.intents).toEqual([pad(Intent.Up, IntentPhase.Press)])
  })

  it('keeps the suppression between 0.4 and 0.6 and lifts it under 0.4', () => {
    const aiming = run(GAMEPAD_RADIAL, [aimed])
    const middle = reading([], { x: 0, y: -0.5 })
    const held = run(GAMEPAD_CLOSED, [middle, reading([], { x: 0, y: -0.7 })], aiming.state)
    expect(held.intents).toEqual([])
    const lifted = run(GAMEPAD_CLOSED, [reading([], { x: 0, y: -0.3 }), aimed], aiming.state)
    expect(lifted.intents).toEqual([pad(Intent.Up, IntentPhase.Press)])
  })

  it('emits no orphan release when the suppressed direction is lifted', () => {
    const aiming = run(GAMEPAD_RADIAL, [aimed])
    const result = run(GAMEPAD_CLOSED, [aimed, reading([], NEUTRAL)], aiming.state)
    expect(result.intents).toEqual([])
  })
})

describe('buttons and stick on the same intent', () => {
  const crossDown = reading([PadControl.FrontendDown])
  const both = reading([PadControl.FrontendDown], { x: 0, y: 0.7 })
  const stickOnly = reading([], { x: 0, y: 0.7 })

  it('presses once when the stick joins a held cross, and releases when the last one lets go', () => {
    const result = run(GAMEPAD_CLOSED, [crossDown, both, crossDown, reading([])])
    expect(result.intents).toEqual([pad(Intent.Down, IntentPhase.Press), pad(Intent.Down, IntentPhase.Release)])
  })

  it('keeps the intent when the cross is released and the stick stays', () => {
    const result = run(GAMEPAD_CLOSED, [both, stickOnly, reading([])])
    expect(result.intents).toEqual([pad(Intent.Down, IntentPhase.Press), pad(Intent.Down, IntentPhase.Release)])
  })

  it('presses once when the stick comes first and the cross joins', () => {
    const result = run(GAMEPAD_CLOSED, [stickOnly, both, stickOnly])
    expect(result.intents).toEqual([pad(Intent.Down, IntentPhase.Press)])
  })
})

describe('diagonal axis switch', () => {
  it('releases one direction and presses the other in the same frame', () => {
    const result = run(GAMEPAD_CLOSED, [reading([], { x: 0.7, y: -0.8 }), reading([], { x: 0.9, y: -0.7 })])
    expect(result.intents).toEqual([
      pad(Intent.Up, IntentPhase.Press),
      pad(Intent.Up, IntentPhase.Release),
      pad(Intent.Right, IntentPhase.Press),
    ])
  })
})
