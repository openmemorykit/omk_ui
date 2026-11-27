import type { ValueOf } from '@openmemorykit/core/shared'
import { describeError } from '../../shared/describe-error'
import { printLimited } from './limited-console'
import type { ClientPorts } from './ports'
import type { SessionStore } from './session-state'
import { ONE_LINE_PER_MINUTE_MS } from './trace'

export const FrameStep = {
  Modality: 'modality',
  Gesture: 'gesture',
  Blocking: 'blocking',
  Pad: 'pad',
  Guard: 'guard',
  Prompt: 'prompt',
  PumpSwitch: 'pumpSwitch',
  IdleTick: 'idleTick',
} as const
export type FrameStep = ValueOf<typeof FrameStep>

export const FRAME_STEP_FAILED_LINE = '[omk_ui] frame step failed, the loop keeps running'

function printStepFailure(ports: ClientPorts, store: SessionStore, step: FrameStep, error: unknown): void {
  try {
    printLimited(ports, store, step, ONE_LINE_PER_MINUTE_MS, `${FRAME_STEP_FAILED_LINE} (${step}): ${describeError(error)}`)
  } catch {
    return
  }
}

export function runGuardedStep<Result>(ports: ClientPorts, store: SessionStore, step: FrameStep, action: () => Result, fallback: Result): Result {
  try {
    return action()
  } catch (error) {
    printStepFailure(ports, store, step, error)
    return fallback
  }
}
