import { InputSource, Modality } from '../../../src/protocol/intents'
import type { IntentEvent, StickEvent, Intent, IntentPhase } from '../../../src/protocol/intents'
import { comparePadSnapshot, primePadSnapshot } from '../../../src/client/domain/pad-snapshot'
import type { PadContext, PadControl, PadReading, PadSnapshotState } from '../../../src/client/domain/pad-snapshot'

export const NEUTRAL: StickEvent = { x: 0, y: 0 }
export const GAMEPAD_CLOSED: PadContext = { modality: Modality.Gamepad, radialOpen: false }
export const GAMEPAD_RADIAL: PadContext = { modality: Modality.Gamepad, radialOpen: true }
export const KEYBOARD: PadContext = { modality: Modality.KeyboardMouse, radialOpen: true }

export function reading(held: readonly PadControl[], stick: StickEvent = NEUTRAL): PadReading {
  return { held: new Set(held), stick }
}

export function pad(intent: Intent, phase: IntentPhase): IntentEvent {
  return { intent, phase, source: InputSource.Pad }
}

export interface RunResult {
  readonly state: PadSnapshotState
  readonly intents: readonly IntentEvent[]
  readonly sticks: readonly (StickEvent | null)[]
}

export function run(
  context: PadContext,
  readings: readonly PadReading[],
  start: PadSnapshotState = primePadSnapshot(reading([])),
): RunResult {
  return readings.reduce(
    (accumulated, current) => {
      const comparison = comparePadSnapshot(accumulated.state, current, context)
      return {
        state: comparison.state,
        intents: [...accumulated.intents, ...comparison.intents],
        sticks: [...accumulated.sticks, comparison.stick],
      }
    },
    { state: start, intents: [] as readonly IntentEvent[], sticks: [] as readonly (StickEvent | null)[] },
  )
}

