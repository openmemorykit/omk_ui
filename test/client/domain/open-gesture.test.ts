import { describe, expect, it } from 'vitest'
import {
  GestureDecision, GesturePhase, GestureSignal, IDLE_GESTURE, stepGesture,
  type GestureInput, type GestureSettings, type GestureState,
} from '../../../src/client/domain/open-gesture'
import { Modality } from '../../../src/protocol/intents'

const HOLD_MS = 300
const START = 1000
const LONG_HOLD_MS = 800
const SECOND_PRESS_DELAY_MS = 10
const settings: GestureSettings = { holdMs: HOLD_MS, padHoldGesture: true }
const pressed: GestureState = { phase: GesturePhase.Pressed, startedAt: START }
const heldPad: GestureState = { phase: GesturePhase.Held, modality: Modality.Gamepad }
const heldKeyboard: GestureState = { phase: GesturePhase.Held, modality: Modality.KeyboardMouse }

interface Row {
  readonly name: string
  readonly state: GestureState
  readonly input: GestureInput
  readonly settings?: GestureSettings
  readonly decision: GestureDecision
  readonly next: GestureState
  readonly block: boolean
}

const rows: readonly Row[] = [
  { name: 'keyboard press opens', state: IDLE_GESTURE, input: { signal: GestureSignal.Press, modality: Modality.KeyboardMouse, at: START }, decision: GestureDecision.Open, next: heldKeyboard, block: false },
  { name: 'pad press starts the hold', state: IDLE_GESTURE, input: { signal: GestureSignal.Press, modality: Modality.Gamepad, at: START }, decision: GestureDecision.Ignore, next: pressed, block: true },
  { name: 'frame before the hold', state: pressed, input: { signal: GestureSignal.Frame, at: START + HOLD_MS - 1 }, decision: GestureDecision.Ignore, next: pressed, block: true },
  { name: 'frame at the hold', state: pressed, input: { signal: GestureSignal.Frame, at: START + HOLD_MS }, decision: GestureDecision.Open, next: heldPad, block: true },
  { name: 'release before the hold cycles', state: pressed, input: { signal: GestureSignal.Release, at: START + HOLD_MS - 1 }, decision: GestureDecision.CycleCamera, next: IDLE_GESTURE, block: true },
  { name: 'release after the hold opens', state: pressed, input: { signal: GestureSignal.Release, at: START + HOLD_MS }, decision: GestureDecision.Open, next: IDLE_GESTURE, block: true },
  { name: 'pad release ends the hold', state: heldPad, input: { signal: GestureSignal.Release, at: START }, decision: GestureDecision.Ignore, next: IDLE_GESTURE, block: true },
  { name: 'keyboard release', state: heldKeyboard, input: { signal: GestureSignal.Release, at: START }, decision: GestureDecision.Ignore, next: IDLE_GESTURE, block: false },
  { name: 'pad press without the hold gesture', state: IDLE_GESTURE, input: { signal: GestureSignal.Press, modality: Modality.Gamepad, at: START }, settings: { holdMs: HOLD_MS, padHoldGesture: false }, decision: GestureDecision.Ignore, next: IDLE_GESTURE, block: false },
  { name: 'stray release', state: IDLE_GESTURE, input: { signal: GestureSignal.Release, at: START }, decision: GestureDecision.Ignore, next: IDLE_GESTURE, block: false },
  { name: 'stray frame', state: IDLE_GESTURE, input: { signal: GestureSignal.Frame, at: START }, decision: GestureDecision.Ignore, next: IDLE_GESTURE, block: false },
  { name: 'second press while pressed', state: pressed, input: { signal: GestureSignal.Press, modality: Modality.Gamepad, at: START + SECOND_PRESS_DELAY_MS }, decision: GestureDecision.Ignore, next: pressed, block: true },
  { name: 'frame while held on pad', state: heldPad, input: { signal: GestureSignal.Frame, at: START }, decision: GestureDecision.Ignore, next: heldPad, block: true },
  { name: 'press while held on keyboard', state: heldKeyboard, input: { signal: GestureSignal.Press, modality: Modality.KeyboardMouse, at: START }, decision: GestureDecision.Ignore, next: heldKeyboard, block: false },
]

describe('stepGesture', () => {
  it.each(rows)('$name', ({ state, input, settings: override, decision, next, block }) => {
    expect(stepGesture(state, input, override ?? settings)).toEqual({ state: next, decision, blockCameraControl: block })
  })

  it.each([IDLE_GESTURE, pressed, heldPad, heldKeyboard])('resets on a mode change from $phase', (state) => {
    expect(stepGesture(state, { signal: GestureSignal.ModeChanged }, settings)).toEqual({ state: IDLE_GESTURE, decision: GestureDecision.Ignore, blockCameraControl: false })
  })

  it('follows the configured hold duration', () => {
    const long: GestureSettings = { holdMs: LONG_HOLD_MS, padHoldGesture: true }
    expect(stepGesture(pressed, { signal: GestureSignal.Frame, at: START + HOLD_MS }, long).decision).toBe(GestureDecision.Ignore)
    expect(stepGesture(pressed, { signal: GestureSignal.Frame, at: START + LONG_HOLD_MS }, long).decision).toBe(GestureDecision.Open)
  })

  it('does not mutate its inputs', () => {
    const input: GestureInput = { signal: GestureSignal.Frame, at: START + HOLD_MS }
    const snapshot = JSON.stringify([pressed, input, settings])
    stepGesture(pressed, input, settings)
    expect(JSON.stringify([pressed, input, settings])).toBe(snapshot)
  })
})
