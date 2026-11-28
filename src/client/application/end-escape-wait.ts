import { GuardSignal, stepReleaseGuard } from '../domain/release-guard'
import type { ClientPorts } from './ports'
import { startOrStopPump } from './pump-switch'
import { FocusReleaseReason, releaseFocus } from './release-focus'
import type { SessionStore } from './session-state'
import { traceReleaseGuard } from './trace-release-guard'

const RELEASE_REASON_BY_SIGNAL = {
  [GuardSignal.EscapeReleased]: FocusReleaseReason.EscapeReleased,
  [GuardSignal.PageBlurred]: FocusReleaseReason.PageBlurred,
} as const

export function endEscapeWait(ports: ClientPorts, store: SessionStore, signal: keyof typeof RELEASE_REASON_BY_SIGNAL): void {
  const session = store.read()
  const step = stepReleaseGuard(session.guard, { signal })
  if (step.ended === null) return
  store.write({ ...session, guard: step.guard })
  traceReleaseGuard(ports, store, false, step.ended)
  releaseFocus(ports, store, RELEASE_REASON_BY_SIGNAL[signal])
  startOrStopPump(ports, store)
}
