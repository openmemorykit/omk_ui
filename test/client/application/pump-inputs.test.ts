import { afterEach, describe, expect, it } from 'vitest'
import { FRAME_STEP_FAILED_LINE, FrameStep } from '../../../src/client/application/limited-console'
import { pumpFrame } from '../../../src/client/application/pump-inputs'
import { ControlGroup } from '../../../src/client/domain/focus-policy'
import { GesturePhase } from '../../../src/client/domain/open-gesture'
import { PadControl, primePadSnapshot } from '../../../src/client/domain/pad-snapshot'
import { InputSource, Intent, IntentPhase, Modality } from '../../../src/protocol/intents'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../src/protocol/to-page'
import { INPUT_DEFAULTS } from '../../../src/shared/config/config-schema'
import { GuardedControl } from '../../../src/client/domain/release-guard'
import { NEUTRAL_PAD } from '../fakes/controls-fake'
import type { ClientPortsFake } from '../fakes/client-ports-fake'
import { expectKeepInputNeverTurnedOn, storeWith, watchedPorts } from './watched-ports'

const NOW = 2000
const LATER = 50
const AIM = { x: 0.8, y: -0.5 }

afterEach(expectKeepInputNeverTurnedOn)

function padPorts(): ClientPortsFake {
  const ports = watchedPorts(NOW)
  ports.controls.setUsingKeyboard(false)
  return ports
}

function openWithPad(mode: UiMode = UiMode.Panels): ReturnType<typeof storeWith> {
  return storeWith({ mode, modality: Modality.Gamepad, pad: primePadSnapshot(NEUTRAL_PAD) })
}

describe('pumpFrame while a menu is open', () => {
  it('blocks every control, the pause buttons on both instances and the pause menu', () => {
    const ports = watchedPorts(NOW)
    pumpFrame(ports, storeWith({ mode: UiMode.Panels }), INPUT_DEFAULTS)
    expect(ports.controls.allDisabledThisFrame).toBe(true)
    expect(ports.controls.disabledThisFrame).toStrictEqual([GuardedControl.FrontendPause, GuardedControl.FrontendPauseAlternate, GuardedControl.FrontendEscape].flatMap((control) => [{ group: ControlGroup.Main, control }, { group: ControlGroup.Frontend, control }]))
    expect(ports.controls.pauseMenuSuppressedThisFrame).toBe(true)
  })

  it('sends pad transitions as numbered intents and starts the unacknowledged clock', () => {
    const ports = padPorts()
    const store = openWithPad()
    ports.controls.setPad({ ...NEUTRAL_PAD, held: new Set([PadControl.FrontendAccept]) })
    pumpFrame(ports, store, INPUT_DEFAULTS)
    ports.clock.advance(LATER)
    ports.controls.setPad(NEUTRAL_PAD)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.nui.sentOfType(ToPage.Intent)).toStrictEqual([
      { type: ToPage.Intent, intent: Intent.Confirm, phase: IntentPhase.Press, source: InputSource.Pad, seq: 1 },
      { type: ToPage.Intent, intent: Intent.Confirm, phase: IntentPhase.Release, source: InputSource.Pad, seq: 2 },
    ])
    expect(store.read().link.intentSeq).toBe(ports.nui.sentOfType(ToPage.Intent).length)
    expect(store.read().link.unackedSince).toBe(NOW)
  })

  it('sends the aim vector while the radial is open', () => {
    const ports = padPorts()
    const store = openWithPad(UiMode.Radial)
    ports.controls.setPad({ ...NEUTRAL_PAD, stick: AIM })
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.nui.sentOfType(ToPage.Stick)).toStrictEqual([{ type: ToPage.Stick, ...AIM }])
  })

  it('does not read the pad in keyboard modality', () => {
    const ports = watchedPorts(NOW)
    pumpFrame(ports, storeWith({ mode: UiMode.Panels, pad: primePadSnapshot(NEUTRAL_PAD) }), INPUT_DEFAULTS)
    expect(ports.controls.calls.map((call) => call.method)).not.toContain('readPad')
  })

  it('primes a missing snapshot without sending anything', () => {
    const ports = padPorts()
    const store = storeWith({ mode: UiMode.Panels, modality: Modality.Gamepad })
    ports.controls.setPad({ ...NEUTRAL_PAD, held: new Set([PadControl.FrontendCancel]) })
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.nui.sentOfType(ToPage.Intent)).toStrictEqual([])
    expect(store.read().pad?.held).toStrictEqual(new Set([PadControl.FrontendCancel]))
  })
})

describe('pumpFrame at rest', () => {
  it('blocks nothing and stops itself when nothing needs it', () => {
    const ports = watchedPorts(NOW)
    ports.pump.start()
    pumpFrame(ports, storeWith(), INPUT_DEFAULTS)
    expect(ports.controls.allDisabledThisFrame).toBe(false)
    expect(ports.controls.disabledThisFrame).toStrictEqual([])
    expect(ports.pump.isRunning()).toBe(false)
  })
})

describe('pumpFrame when a domain throws', () => {
  it('prints the failing step, still blocks the controls and keeps the pump running', () => {
    const ports = padPorts()
    ports.pump.start()
    const store = openWithPad()
    const failingPad = { ...ports, controls: { ...ports.controls, readPad: (): never => { throw new Error('pad exploded') } } }
    pumpFrame(failingPad, store, INPUT_DEFAULTS)
    expect(ports.console.printed).toStrictEqual([`${FRAME_STEP_FAILED_LINE} (${FrameStep.Pad}): pad exploded`])
    expect(ports.controls.allDisabledThisFrame).toBe(true)
    expect(ports.pump.isRunning()).toBe(true)
    ports.controls.endFrame()
    ports.controls.setPad({ ...NEUTRAL_PAD, held: new Set([PadControl.FrontendUp]) })
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.nui.sentOfType(ToPage.Intent)).toHaveLength(1)
  })

  it('keeps control 0 blocked when the gesture step throws during a pad hold', () => {
    const ports = padPorts()
    const store = storeWith({ gesture: { phase: GesturePhase.Pressed, startedAt: NOW } })
    const failingRead = { ...ports, controls: { ...ports.controls, isDisabledPressed: (): never => { throw new Error('read failed') } } }
    pumpFrame(failingRead, store, INPUT_DEFAULTS)
    expect(ports.controls.disabledThisFrame).toContainEqual({ group: ControlGroup.Main, control: 0 })
    expect(ports.console.printed[0]).toContain(FrameStep.Gesture)
  })
})
