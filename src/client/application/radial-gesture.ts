import { Modality } from '../../protocol/intents'
import { UiMode } from '../../protocol/page-vocabulary'
import { ToPage } from '../../protocol/to-page'
import type { InputConfig } from '../../shared/config/config-schema'
import { ReportKind } from '../../shared/report/report-kind'
import { DEFAULT_CAMERA_CYCLE, nextCameraMode } from '../domain/camera-cycle'
import { ControlGroup } from '../domain/focus-policy'
import { firstOpenBlocker, openConditionsFrom, OpenPurpose, type OpenConditions, type OpenGate } from '../domain/open-blockers'
import { GestureDecision, GesturePhase, GestureSignal, stepGesture } from '../domain/open-gesture'
import type { GestureSettings, GestureState, GestureStep } from '../domain/open-gesture'
import { GuardKind, VIEW_CONTROL } from '../domain/release-guard'
import { changeModality, readModality, resumeFromPause } from './apply-focus'
import { FrameStep, ONCE_PER_KIT_LIFETIME, printLimited, runGuardedStep } from './limited-console'
import type { ClientPorts } from './ports'
import { startOrStopPump } from './pump-switch'
import type { ClientSession, SessionStore } from './session-state'
import { traceLine } from './trace'

export const RADIAL_COMMAND_IGNORED_KEY = 'radialCommandIgnored'
export const RADIAL_COMMAND_IGNORED_LINE = '[omk_ui] +omk_ui_radial ignored: a menu is already open (printed once)'
const PLUS_COMMAND_KEYBOARD_SOURCE_MODALITY = Modality.KeyboardMouse

export function gestureSettings(input: InputConfig): GestureSettings {
  return { holdMs: input.padHoldMs, padHoldGesture: input.padHoldGesture }
}

export function isPadGesture(gesture: GestureState): boolean {
  return gesture.phase === GesturePhase.Pressed || (gesture.phase === GesturePhase.Held && gesture.modality === Modality.Gamepad)
}

export function startIdleTick(ports: ClientPorts, input: InputConfig): void {
  if (input.padHoldGesture) ports.idle.start()
}

function gestureSituation(ports: ClientPorts, session: ClientSession, input: InputConfig): Omit<OpenConditions, keyof OpenGate> {
  const drivenSpeed = ports.game.drivenVehicleSpeed()
  return {
    pauseMenuActive: ports.game.isPauseMenuActive(),
    otherNuiFocus: ports.game.isNuiFocused() && session.guard.kind !== GuardKind.Escape,
    screenFaded: ports.game.isScreenFaded(),
    driving: drivenSpeed !== null,
    vehicleSpeedMetersPerSecond: drivenSpeed ?? 0,
    vehicleSpeedLimitKmh: input.vehicleSpeedLimit,
    radialEntryCount: session.registry.radialEntries.length,
    caller: null,
    now: ports.clock.now(),
  }
}

function replayCamera(ports: ClientPorts, store: SessionStore, input: InputConfig): void {
  const context = ports.camera.context()
  const before = ports.camera.read(context)
  const expected = nextCameraMode(before, DEFAULT_CAMERA_CYCLE, input.cameraSkippedModes)
  ports.camera.write(context, expected)
  const actual = ports.camera.read(context)
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.CameraReplayed, data: { context, before, expected, actual } })
}

function followDecision(ports: ClientPorts, store: SessionStore, input: InputConfig, decision: GestureDecision): void {
  if (decision === GestureDecision.Open) ports.nui.send({ type: ToPage.OpenRadial })
  if (decision === GestureDecision.CycleCamera) replayCamera(ports, store, input)
}

function pressGesture(ports: ClientPorts, store: SessionStore, input: InputConfig, modality: Modality): GestureStep | null {
  const session = store.read()
  const blocker = firstOpenBlocker(openConditionsFrom(session.gate, gestureSituation(ports, session, input)), OpenPurpose.RadialGesture)
  if (blocker !== null) {
    traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.OpenRefused, data: { reason: blocker } })
    return null
  }
  const step = stepGesture(session.gesture, { signal: GestureSignal.Press, modality, at: ports.clock.now() }, gestureSettings(input))
  store.write({ ...session, gesture: step.state })
  followDecision(ports, store, input, step.decision)
  startOrStopPump(ports, store)
  return step
}

export function radialPress(ports: ClientPorts, store: SessionStore, input: InputConfig): void {
  const session = store.read()
  if (session.paused) {
    resumeFromPause(ports, store)
    return
  }
  if (session.mode !== UiMode.Idle) {
    printLimited(ports, store, RADIAL_COMMAND_IGNORED_KEY, ONCE_PER_KIT_LIFETIME, RADIAL_COMMAND_IGNORED_LINE)
    return
  }
  changeModality(ports, store, readModality(ports))
  pressGesture(ports, store, input, PLUS_COMMAND_KEYBOARD_SOURCE_MODALITY)
}

export function radialRelease(ports: ClientPorts, store: SessionStore, input: InputConfig): void {
  const session = store.read()
  const gesture = session.gesture
  if (gesture.phase !== GesturePhase.Held || gesture.modality !== PLUS_COMMAND_KEYBOARD_SOURCE_MODALITY) return
  const step = stepGesture(gesture, { signal: GestureSignal.Release, at: ports.clock.now() }, gestureSettings(input))
  store.write({ ...session, gesture: step.state })
  startOrStopPump(ports, store)
}

function readViewPress(ports: ClientPorts, store: SessionStore, input: InputConfig): void {
  const session = store.read()
  const listening = session.mode === UiMode.Idle || session.paused
  if (!listening || session.gesture.phase !== GesturePhase.Idle) return
  if (!ports.controls.isJustPressed(VIEW_CONTROL) || readModality(ports) !== Modality.Gamepad) return
  if (session.paused) {
    resumeFromPause(ports, store)
    return
  }
  changeModality(ports, store, Modality.Gamepad)
  const step = pressGesture(ports, store, input, Modality.Gamepad)
  if (step?.blockCameraControl === true) ports.controls.disable(ControlGroup.Main, VIEW_CONTROL)
}

export function idleFrame(ports: ClientPorts, store: SessionStore, input: InputConfig): void {
  runGuardedStep(ports, store, FrameStep.IdleTick, () => readViewPress(ports, store, input), undefined)
}

export function stepPadGestureFrame(ports: ClientPorts, store: SessionStore, input: InputConfig): boolean {
  const session = store.read()
  if (!isPadGesture(session.gesture)) return false
  const at = ports.clock.now()
  const viewHeld = ports.controls.isDisabledPressed(VIEW_CONTROL)
  const signal = viewHeld ? { signal: GestureSignal.Frame, at } : { signal: GestureSignal.Release, at }
  const step = stepGesture(session.gesture, signal, gestureSettings(input))
  store.write({ ...session, gesture: step.state })
  followDecision(ports, store, input, step.decision)
  return step.blockCameraControl
}
