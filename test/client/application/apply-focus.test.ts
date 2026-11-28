import { afterEach, describe, expect, it } from 'vitest'
import { FocusApplyReason, PUSH_TO_TALK_CONVAR } from '../../../src/client/application/apply-focus'
import { applyModeChanged } from '../../../src/client/application/apply-mode-changed'
import { applyPaused } from '../../../src/client/application/apply-paused'
import { applyTextEntry } from '../../../src/client/application/apply-text-entry'
import { resumeFromPause } from '../../../src/client/application/resume-from-pause'
import { pumpFrame } from '../../../src/client/application/pump-inputs'
import { ControlGroup, PUSH_TO_TALK_CONTROL, PushToTalkPolicy } from '../../../src/client/domain/focus-policy'
import { GesturePhase } from '../../../src/client/domain/open-gesture'
import { PadControl } from '../../../src/client/domain/pad-snapshot'
import { Modality } from '../../../src/protocol/intents'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../src/protocol/to-page'
import { INPUT_DEFAULTS } from '../../../src/shared/config/config-schema'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { NEUTRAL_PAD } from '../fakes/controls-fake'
import { expectKeepInputNeverTurnedOn, linesOf, storeWith, watchedPorts } from './watched-ports'

const NOW = 1000
const COOLDOWN_UNTIL = 5000
const TWO_FRAMES = 2
const PUSH_TO_TALK = { group: ControlGroup.Main, control: PUSH_TO_TALK_CONTROL }

afterEach(expectKeepInputNeverTurnedOn)

describe('applyModeChanged when a menu opens', () => {
  it('takes the focus with the cursor in keyboard modality, keepInput off, and traces both', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith()
    applyModeChanged(ports, store, { mode: UiMode.Radial })
    expect(ports.nui.focusChanges).toStrictEqual([{ focus: true, cursor: true }])
    expect(ports.nui.keepInputChanges).toStrictEqual([false])
    expect(linesOf(store, ReportKind.ModeChanged).map((line) => line.data)).toStrictEqual([{ from: UiMode.Idle, to: UiMode.Radial }])
    expect(linesOf(store, ReportKind.FocusApplied).map((line) => line.data)).toStrictEqual([{ focus: true, cursor: true, keepInput: false, reason: FocusApplyReason.ModeChanged }])
    expect(ports.pump.isRunning()).toBe(true)
  })

  it('hides the cursor in pad modality and while waiting for a panel', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ modality: Modality.Gamepad })
    applyModeChanged(ports, store, { mode: UiMode.Radial })
    store.write({ ...store.read(), modality: Modality.KeyboardMouse })
    applyModeChanged(ports, store, { mode: UiMode.Waiting })
    expect(ports.nui.focusChanges).toStrictEqual([{ focus: true, cursor: false }, { focus: true, cursor: false }])
  })

  it('sets radialOpened on the gate when the radial opens', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ gate: { cooldownUntil: COOLDOWN_UNTIL, reservedFor: null } })
    applyModeChanged(ports, store, { mode: UiMode.Radial })
    expect(store.read().gate.cooldownUntil).toBeNull()
  })

  it('leaves the gate alone when panels open', () => {
    const ports = watchedPorts(NOW)
    const gate = { cooldownUntil: COOLDOWN_UNTIL, reservedFor: null }
    const store = storeWith({ gate })
    applyModeChanged(ports, store, { mode: UiMode.Panels })
    expect(store.read().gate).toBe(gate)
  })

  it('primes the pad snapshot so that View still held after the opening is no radial press', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ modality: Modality.Gamepad, gesture: { phase: GesturePhase.Held, modality: Modality.Gamepad } })
    ports.controls.setUsingKeyboard(false)
    ports.controls.setPad({ ...NEUTRAL_PAD, held: new Set([PadControl.NextCamera]) })
    applyModeChanged(ports, store, { mode: UiMode.Radial })
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.nui.sentOfType(ToPage.Intent)).toStrictEqual([])
    expect(store.read().gesture.phase).toBe(GesturePhase.Idle)
  })

  it('ignores a repeated mode', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels })
    const before = store.read()
    applyModeChanged(ports, store, { mode: UiMode.Panels })
    expect(store.read()).toBe(before)
    expect(ports.nui.focusChanges).toStrictEqual([])
  })
})

describe('applyModeChanged back to Idle', () => {
  it('gives the focus back, sets keepInput false, clears the text entry and stops the pump', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels, textEntry: true })
    ports.pump.start()
    applyModeChanged(ports, store, { mode: UiMode.Idle })
    expect(ports.nui.focusChanges).toStrictEqual([{ focus: false, cursor: false }])
    expect(ports.nui.keepInputChanges).toStrictEqual([false])
    expect(store.read().textEntry).toBe(false)
    expect(store.read().pad).toBeNull()
    expect(ports.pump.isRunning()).toBe(false)
  })

  it('ends a pause when everything closed meanwhile', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels, paused: true })
    applyModeChanged(ports, store, { mode: UiMode.Idle })
    expect(store.read().paused).toBe(false)
    expect(ports.nui.keepInputChanges).toStrictEqual([false])
  })
})

describe('applyPaused', () => {
  it('pauses an open menu: focus back to the game, keepInput untouched, no blocking', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels })
    applyPaused(ports, store, true)
    expect(store.read().paused).toBe(true)
    expect(ports.nui.focusChanges).toStrictEqual([{ focus: false, cursor: false }])
    expect(ports.nui.keepInputChanges).toStrictEqual([])
    expect(linesOf(store, ReportKind.PagePaused).map((line) => line.data)).toStrictEqual([{ paused: true }])
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.controls.allDisabledThisFrame).toBe(false)
    expect(ports.controls.disabledThisFrame).toStrictEqual([])
  })

  it('touches nothing for a modality change during the pause', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels, paused: true })
    ports.controls.setUsingKeyboard(false)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(store.read().modality).toBe(Modality.Gamepad)
    expect(ports.nui.focusChanges).toStrictEqual([])
    expect(ports.nui.keepInputChanges).toStrictEqual([])
  })

  it('ignores a blur once the kit has closed and given the focus back', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith()
    applyPaused(ports, store, true)
    expect(store.read().paused).toBe(false)
    expect(ports.nui.focusChanges).toStrictEqual([])
    expect(linesOf(store, ReportKind.PagePaused)).toStrictEqual([])
  })

  it('resumes nothing when the kit is not paused', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels })
    const before = store.read()
    resumeFromPause(ports, store)
    expect(store.read()).toBe(before)
    expect(ports.nui.focusChanges).toStrictEqual([])
  })

  it('ignores a second pause and never takes the focus back on its own', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels, paused: true })
    applyPaused(ports, store, true)
    applyPaused(ports, store, false)
    expect(store.read().paused).toBe(true)
    expect(ports.nui.focusChanges).toStrictEqual([])
  })
})

describe('applyTextEntry and push-to-talk', () => {
  it('keeps 249 blocked by default, reading the convar at every frame', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels })
    pumpFrame(ports, store, INPUT_DEFAULTS)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.controls.enabledThisFrame).toStrictEqual([])
    expect(ports.controls.allDisabledThisFrame).toBe(true)
    expect(ports.convars.requested.filter((name) => name === PUSH_TO_TALK_CONVAR)).toHaveLength(TWO_FRAMES)
  })

  it('re-enables 249 when the convar says so, and blocks it again during a text entry', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels })
    ports.convars.set(PUSH_TO_TALK_CONVAR, PushToTalkPolicy.Reenabled)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.controls.enabledThisFrame).toStrictEqual([PUSH_TO_TALK])
    ports.controls.endFrame()
    applyTextEntry(ports, store, true)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.controls.enabledThisFrame).toStrictEqual([])
    expect(linesOf(store, ReportKind.TextEntry).map((line) => line.data)).toStrictEqual([{ active: true }])
  })

  it('falls back to blocked on an unknown convar value', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels })
    ports.convars.set(PUSH_TO_TALK_CONVAR, 'loud')
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.controls.enabledThisFrame).toStrictEqual([])
  })

  it('ignores a text entry in Idle and a repeated one', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith()
    applyTextEntry(ports, store, true)
    applyTextEntry(ports, store, false)
    expect(store.read().textEntry).toBe(false)
    expect(linesOf(store, ReportKind.TextEntry)).toStrictEqual([])
  })

  it('ignores the switch to keyboard and mouse while 249 is held, then follows it', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels, modality: Modality.Gamepad })
    ports.controls.pressControl(PUSH_TO_TALK_CONTROL)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(store.read().modality).toBe(Modality.Gamepad)
    ports.controls.releaseControl(PUSH_TO_TALK_CONTROL)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(store.read().modality).toBe(Modality.KeyboardMouse)
    expect(ports.nui.sentOfType(ToPage.Modality)).toStrictEqual([{ type: ToPage.Modality, modality: Modality.KeyboardMouse }])
    expect(ports.nui.focusChanges).toStrictEqual([{ focus: true, cursor: true }])
  })

  it('switches to the pad even while 249 is held', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels })
    ports.controls.setUsingKeyboard(false)
    ports.controls.pressControl(PUSH_TO_TALK_CONTROL)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(store.read().modality).toBe(Modality.Gamepad)
    expect(ports.nui.focusChanges).toStrictEqual([{ focus: true, cursor: false }])
  })
})
