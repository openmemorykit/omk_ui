import { convarChoice, readConvar, type ValueOf } from '@openmemorykit/core/shared'
import { Modality } from '../../protocol/intents'
import { UiMode } from '../../protocol/page-vocabulary'
import { ToPage } from '../../protocol/to-page'
import { ReportKind } from '../../shared/report/report-kind'
import { decideFocus, PushToTalkPolicy, type FocusDecision } from '../domain/focus-policy'
import { radialOpened } from '../domain/open-blockers'
import { IDLE_GESTURE } from '../domain/open-gesture'
import { PadControl, primePadSnapshot } from '../domain/pad-snapshot'
import { guardedControls, GuardKind, GuardSignal, NO_GUARD, startEscapeGuard, startPadGuard, stepReleaseGuard } from '../domain/release-guard'
import type { ReleaseGuard } from '../domain/release-guard'
import type { ClientPorts } from './ports'
import { startOrStopPump } from './pump-switch'
import { FocusReleaseReason, releaseFocus } from './release-focus'
import type { ClientSession, SessionStore } from './session-state'
import { traceLine } from './trace'

export const PUSH_TO_TALK_CONVAR = 'omk_ui_ptt'

export const FocusApplyReason = { ModeChanged: 'modeChanged', ModalityChanged: 'modalityChanged', Resumed: 'resumed', EscapeWait: 'escapeWait' } as const
export type FocusApplyReason = ValueOf<typeof FocusApplyReason>

export interface ModeChange {
  readonly mode: UiMode
  readonly escapeHeld?: true
}

const PushToTalkSchema = convarChoice(PushToTalkPolicy)
const PAD_CLOSING_CONTROLS: readonly PadControl[] = Object.freeze([PadControl.NextCamera, PadControl.FrontendCancel, PadControl.FrontendPause])
const RELEASE_REASON_BY_SIGNAL = {
  [GuardSignal.EscapeReleased]: FocusReleaseReason.EscapeReleased,
  [GuardSignal.PageBlurred]: FocusReleaseReason.PageBlurred,
} as const

export function readModality(ports: ClientPorts): Modality {
  return ports.controls.isUsingKeyboard() ? Modality.KeyboardMouse : Modality.Gamepad
}

export function decideSessionFocus(ports: ClientPorts, session: ClientSession): FocusDecision {
  return decideFocus({
    mode: session.mode,
    modality: session.modality,
    paused: session.paused,
    awaitingEscapeRelease: session.guard.kind === GuardKind.Escape,
    releaseGuardControls: guardedControls(session.guard),
    textEntryActive: session.textEntry,
    pushToTalk: readConvar(ports.convars, PUSH_TO_TALK_CONVAR, PushToTalkSchema, PushToTalkPolicy.Blocked).value,
  })
}

export function applyFocus(ports: ClientPorts, store: SessionStore, reason: FocusApplyReason): void {
  const session = store.read()
  if (session.paused) return
  const decision = decideSessionFocus(ports, session)
  if (!decision.focus) return
  ports.nui.setFocus(true, decision.cursor)
  ports.nui.setKeepInput(false)
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.FocusApplied, data: { focus: true, cursor: decision.cursor, keepInput: false, reason } })
}

export function changeModality(ports: ClientPorts, store: SessionStore, modality: Modality): void {
  const session = store.read()
  if (session.modality === modality) return
  store.write({ ...session, modality })
  ports.nui.send({ type: ToPage.Modality, modality })
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.ModalityChanged, data: { modality } })
  applyFocus(ports, store, FocusApplyReason.ModalityChanged)
}

function traceReleaseGuard(ports: ClientPorts, store: SessionStore, active: boolean, guard: string): void {
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.ReleaseGuard, data: { active, guard } })
}

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

export function resumeFromPause(ports: ClientPorts, store: SessionStore): void {
  const session = store.read()
  if (!session.paused) return
  store.write({ ...session, paused: false, pad: primePadSnapshot(ports.controls.readPad()) })
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.PagePaused, data: { paused: false } })
  applyFocus(ports, store, FocusApplyReason.Resumed)
  startOrStopPump(ports, store)
}

function endEscapeWait(ports: ClientPorts, store: SessionStore, signal: keyof typeof RELEASE_REASON_BY_SIGNAL): void {
  const session = store.read()
  const step = stepReleaseGuard(session.guard, { signal })
  if (step.ended === null) return
  store.write({ ...session, guard: step.guard })
  traceReleaseGuard(ports, store, false, step.ended)
  releaseFocus(ports, store, RELEASE_REASON_BY_SIGNAL[signal])
  startOrStopPump(ports, store)
}

export function applyEscapeReleased(ports: ClientPorts, store: SessionStore): void {
  endEscapeWait(ports, store, GuardSignal.EscapeReleased)
}

export function applyPaused(ports: ClientPorts, store: SessionStore, paused: boolean): void {
  if (!paused) return
  const session = store.read()
  if (session.guard.kind === GuardKind.Escape) {
    endEscapeWait(ports, store, GuardSignal.PageBlurred)
    return
  }
  if (session.mode === UiMode.Idle || session.paused) return
  store.write({ ...session, paused: true })
  ports.nui.setFocus(false, false)
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.PagePaused, data: { paused: true } })
}

export function applyTextEntry(ports: ClientPorts, store: SessionStore, active: boolean): void {
  const session = store.read()
  const textEntry = active && session.mode !== UiMode.Idle
  if (textEntry === session.textEntry) return
  store.write({ ...session, textEntry })
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.TextEntry, data: { active: textEntry } })
}

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
