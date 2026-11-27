import { Modality } from '../../protocol/intents'
import { UiMode } from '../../protocol/page-vocabulary'
import { ReportKind } from '../../shared/report/report-kind'
import { radialOpened } from '../domain/open-blockers'
import { IDLE_GESTURE } from '../domain/open-gesture'
import { PadControl, primePadSnapshot } from '../domain/pad-snapshot'
import { GuardKind, NO_GUARD, startEscapeGuard, startPadGuard } from '../domain/release-guard'
import type { ReleaseGuard } from '../domain/release-guard'
import { applyFocus, FocusApplyReason } from './apply-focus'
import type { ClientPorts } from './ports'
import { startOrStopPump } from './pump-switch'
import { FocusReleaseReason, releaseFocus } from './release-focus'
import type { ClientSession, SessionStore } from './session-state'
import { traceLine } from './trace'
import { traceReleaseGuard } from './trace-release-guard'

export interface ModeChange {
  readonly mode: UiMode
  readonly escapeHeld?: true
}

const PAD_CLOSING_CONTROLS: readonly PadControl[] = Object.freeze([PadControl.NextCamera, PadControl.FrontendCancel, PadControl.FrontendPause])

function closingGuard(ports: ClientPorts, session: ClientSession, change: ModeChange, now: number): ReleaseGuard {
  if (change.escapeHeld === true) return startEscapeGuard(now)
  if (session.modality !== Modality.Gamepad) return NO_GUARD
  const held = ports.controls.readPad().held
  const closingControl = PAD_CLOSING_CONTROLS.find((control) => held.has(control))
  return closingControl === undefined ? NO_GUARD : startPadGuard(closingControl, now)
}

function closedSession(ports: ClientPorts, session: ClientSession, change: ModeChange): ClientSession {
  const guard = closingGuard(ports, session, change, ports.clock.now())
  return { ...session, mode: UiMode.Idle, paused: false, pad: null, textEntry: false, gesture: IDLE_GESTURE, guard }
}

function openedSession(ports: ClientPorts, session: ClientSession, mode: UiMode): ClientSession {
  const leavingIdle = session.mode === UiMode.Idle
  const gate = mode === UiMode.Radial ? radialOpened(session.gate) : session.gate
  const pad = leavingIdle || session.pad === null ? primePadSnapshot(ports.controls.readPad()) : session.pad
  return { ...session, mode, gate, pad, gesture: IDLE_GESTURE, guard: leavingIdle ? NO_GUARD : session.guard }
}

function settleFocusAfterModeChange(ports: ClientPorts, store: SessionStore): void {
  const session = store.read()
  if (session.mode !== UiMode.Idle) applyFocus(ports, store, FocusApplyReason.ModeChanged)
  else if (session.guard.kind === GuardKind.Escape) applyFocus(ports, store, FocusApplyReason.EscapeWait)
  else releaseFocus(ports, store, FocusReleaseReason.ReturnedToIdle)
}

export function applyModeChanged(ports: ClientPorts, store: SessionStore, change: ModeChange): void {
  const session = store.read()
  if (change.mode === session.mode) return
  const next = change.mode === UiMode.Idle ? closedSession(ports, session, change) : openedSession(ports, session, change.mode)
  store.write(next)
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.ModeChanged, data: { from: session.mode, to: next.mode } })
  if (next.mode === UiMode.Idle && next.guard.kind !== GuardKind.None) traceReleaseGuard(ports, store, true, next.guard.kind)
  settleFocusAfterModeChange(ports, store)
  startOrStopPump(ports, store)
}
