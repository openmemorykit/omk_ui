import { GuardKind, GuardSignal, stepReleaseGuard } from '../domain/release-guard'
import type { ClientPorts } from './ports'
import { FocusReleaseReason, releaseFocus } from './release-focus'
import type { SessionStore } from './session-state'
import { traceReleaseGuard } from './trace-release-guard'

export function stepGuardFrame(ports: ClientPorts, store: SessionStore): void {
  const session = store.read()
  const guard = session.guard
  if (guard.kind === GuardKind.None) return
  const closingControlHeld = guard.kind === GuardKind.Pad && ports.controls.isDisabledPressed(guard.closingControl)
  const step = stepReleaseGuard(guard, { signal: GuardSignal.Frame, now: ports.clock.now(), closingControlHeld })
  if (step.ended === null) return
  store.write({ ...session, guard: step.guard })
  traceReleaseGuard(ports, store, false, step.ended)
  if (guard.kind === GuardKind.Escape) releaseFocus(ports, store, FocusReleaseReason.EscapeWaitCapped)
}
