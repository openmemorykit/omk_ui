import type { ValueOf } from '@openmemorykit/core/shared'
import type { ClientPorts } from './ports'
import type { SessionStore } from './session-state'
import { limitedWindowStillOpen, ONE_LINE_PER_MINUTE_MS, rememberedAt } from './trace'

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

export const ONCE_PER_KIT_LIFETIME = Number.POSITIVE_INFINITY
export const FRAME_STEP_FAILED_LINE = '[omk_ui] frame step failed, the loop keeps running'

const CONSOLE_KEY_PREFIX = 'console:'

export function printLimited(ports: ClientPorts, store: SessionStore, key: string, intervalMs: number, line: string): void {
  const now = ports.clock.now()
  const session = store.read()
  const consoleKey = `${CONSOLE_KEY_PREFIX}${key}`
  if (limitedWindowStillOpen(session.trace.lastLimitedAt, consoleKey, now, intervalMs)) return
  store.write({ ...session, trace: { ...session.trace, lastLimitedAt: rememberedAt(session.trace.lastLimitedAt, consoleKey, now) } })
  ports.console.print(line)
}

function describeError(error: unknown): string {
  try {
    return error instanceof Error ? error.message : String(error)
  } catch {
    return typeof error
  }
}

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
