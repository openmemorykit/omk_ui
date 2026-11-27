import { Modality, type IntentEvent } from '../../protocol/intents'
import { UiMode } from '../../protocol/page-vocabulary'
import { ToPage } from '../../protocol/to-page'
import type { InputConfig } from '../../shared/config/config-schema'
import { ControlGroup, PUSH_TO_TALK_CONTROL } from '../domain/focus-policy'
import { comparePadSnapshot, primePadSnapshot } from '../domain/pad-snapshot'
import { VIEW_CONTROL } from '../domain/release-guard'
import { changeModality, decideSessionFocus, readModality, stepGuardFrame } from './apply-focus'
import { FrameStep, runGuardedStep } from './limited-console'
import type { ClientPorts } from './ports'
import { startOrStopPump } from './pump-switch'
import { isPadGesture, stepPadGestureFrame } from './radial-gesture'
import type { PageLink, SessionStore } from './session-state'
import { trackPromptFrame } from './track-prompts'

function followModality(ports: ClientPorts, store: SessionStore): void {
  const modality = readModality(ports)
  if (modality === store.read().modality) return
  const talkingOnKeyboard = modality === Modality.KeyboardMouse && ports.controls.isDisabledPressed(PUSH_TO_TALK_CONTROL)
  if (!talkingOnKeyboard) changeModality(ports, store, modality)
}

function applyFrameBlocking(ports: ClientPorts, store: SessionStore, blockViewControl: boolean): void {
  const decision = decideSessionFocus(ports, store.read())
  if (decision.disableAllControls) ports.controls.disableAll()
  decision.blocked.forEach(({ group, control }) => ports.controls.disable(group, control))
  decision.enabled.forEach(({ group, control }) => ports.controls.enable(group, control))
  if (decision.suppressPauseMenu) ports.controls.suppressPauseMenu()
  if (blockViewControl) ports.controls.disable(ControlGroup.Main, VIEW_CONTROL)
}

function sendIntent(ports: ClientPorts, link: PageLink, intent: IntentEvent): PageLink {
  const seq = link.intentSeq + 1
  ports.nui.send({ type: ToPage.Intent, ...intent, seq })
  const now = ports.clock.now()
  return { ...link, intentSeq: seq, unackedSince: link.unackedSince ?? now, lastIntent: { intent: intent.intent, source: intent.source, seq, at: now } }
}

function sendPadIntents(ports: ClientPorts, store: SessionStore): void {
  const session = store.read()
  if (session.mode === UiMode.Idle || session.paused || session.modality !== Modality.Gamepad) return
  const reading = ports.controls.readPad()
  if (session.pad === null) {
    store.write({ ...session, pad: primePadSnapshot(reading) })
    return
  }
  const comparison = comparePadSnapshot(session.pad, reading, { modality: session.modality, radialOpen: session.mode === UiMode.Radial })
  const link = comparison.intents.reduce((current, intent) => sendIntent(ports, current, intent), session.link)
  if (comparison.stick !== null) ports.nui.send({ type: ToPage.Stick, ...comparison.stick })
  store.write({ ...session, pad: comparison.state, link })
}

export function pumpFrame(ports: ClientPorts, store: SessionStore, input: InputConfig): void {
  const padGestureHeld = isPadGesture(store.read().gesture)
  runGuardedStep(ports, store, FrameStep.Modality, () => followModality(ports, store), undefined)
  const blockViewControl = runGuardedStep(ports, store, FrameStep.Gesture, () => stepPadGestureFrame(ports, store, input), padGestureHeld)
  runGuardedStep(ports, store, FrameStep.Blocking, () => applyFrameBlocking(ports, store, blockViewControl), undefined)
  runGuardedStep(ports, store, FrameStep.Pad, () => sendPadIntents(ports, store), undefined)
  runGuardedStep(ports, store, FrameStep.Guard, () => stepGuardFrame(ports, store), undefined)
  runGuardedStep(ports, store, FrameStep.Prompt, () => trackPromptFrame(ports, store), undefined)
  runGuardedStep(ports, store, FrameStep.PumpSwitch, () => startOrStopPump(ports, store), undefined)
}
