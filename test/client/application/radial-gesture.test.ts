import { OpenBlocker } from '@openmemorykit/ui/contract'
import { afterEach, describe, expect, it } from 'vitest'
import { pumpFrame } from '../../../src/client/application/pump-inputs'
import { idleFrame, RADIAL_COMMAND_IGNORED_LINE, radialPress, radialRelease, startIdleTick } from '../../../src/client/application/radial-gesture'
import { ControlGroup } from '../../../src/client/domain/focus-policy'
import { GesturePhase } from '../../../src/client/domain/open-gesture'
import { VIEW_CONTROL } from '../../../src/client/domain/release-guard'
import { Modality } from '../../../src/protocol/intents'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../src/protocol/to-page'
import { INPUT_DEFAULTS } from '../../../src/shared/config/config-schema'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { expectKeepInputNeverTurnedOn, linesOf, REGISTRY_WITH_RADIAL_ENTRY, storeWith, watchedPorts } from './watched-ports'

const INPUT = INPUT_DEFAULTS
const KMH_ABOVE_LIMIT_IN_METERS_PER_SECOND = 5

afterEach(expectKeepInputNeverTurnedOn)

function readyStore(): ReturnType<typeof storeWith> {
  return storeWith({ registry: REGISTRY_WITH_RADIAL_ENTRY })
}

describe('radialPress, the keyboard command', () => {
  it('opens the radial at the press and runs the pump while the gesture is held', () => {
    const ports = watchedPorts()
    const store = readyStore()
    radialPress(ports, store, INPUT)
    expect(ports.nui.sent).toStrictEqual([{ type: ToPage.OpenRadial }])
    expect(store.read().gesture).toStrictEqual({ phase: GesturePhase.Held, modality: Modality.KeyboardMouse })
    expect(ports.pump.isRunning()).toBe(true)
  })

  it('opens at the press from a pad binding too, with the real modality sent to the page', () => {
    const ports = watchedPorts()
    const store = readyStore()
    ports.controls.setUsingKeyboard(false)
    radialPress(ports, store, INPUT)
    expect(ports.nui.sent).toStrictEqual([{ type: ToPage.Modality, modality: Modality.Gamepad }, { type: ToPage.OpenRadial }])
    expect(store.read().modality).toBe(Modality.Gamepad)
    expect(linesOf(store, ReportKind.ModalityChanged)).toHaveLength(1)
  })

  it('ends the gesture at the release without any console line', () => {
    const ports = watchedPorts()
    const store = readyStore()
    radialPress(ports, store, INPUT)
    radialRelease(ports, store, INPUT)
    expect(store.read().gesture.phase).toBe(GesturePhase.Idle)
    expect(ports.pump.isRunning()).toBe(false)
    expect(ports.console.printed).toStrictEqual([])
  })

  it('ignores the press outside Idle with one console line in the kit lifetime', () => {
    const ports = watchedPorts()
    const store = storeWith({ registry: REGISTRY_WITH_RADIAL_ENTRY, mode: UiMode.Panels })
    radialPress(ports, store, INPUT)
    radialRelease(ports, store, INPUT)
    radialPress(ports, store, INPUT)
    expect(ports.nui.sent).toStrictEqual([])
    expect(ports.console.printed).toStrictEqual([RADIAL_COMMAND_IGNORED_LINE])
  })

  it('stays silent for the release that follows an opening', () => {
    const ports = watchedPorts()
    const store = readyStore()
    radialPress(ports, store, INPUT)
    store.write({ ...store.read(), mode: UiMode.Radial, gesture: { phase: GesturePhase.Idle } })
    radialRelease(ports, store, INPUT)
    expect(ports.console.printed).toStrictEqual([])
  })

  it('resumes a paused kit without reopening the radial', () => {
    const ports = watchedPorts()
    const store = storeWith({ registry: REGISTRY_WITH_RADIAL_ENTRY, mode: UiMode.Panels, paused: true })
    radialPress(ports, store, INPUT)
    expect(store.read().paused).toBe(false)
    expect(ports.nui.focusChanges).toStrictEqual([{ focus: true, cursor: true }])
    expect(ports.nui.sentOfType(ToPage.OpenRadial)).toStrictEqual([])
    expect(linesOf(store, ReportKind.PagePaused).at(-1)?.data).toStrictEqual({ paused: false })
  })

  it.each([
    ['the pause menu is open', { pauseMenuActive: true }, OpenBlocker.PauseMenu],
    ['another resource holds the NUI focus', { nuiFocused: true }, OpenBlocker.OtherNuiFocus],
    ['the screen is faded', { screenFaded: true }, OpenBlocker.ScreenFaded],
    ['the player drives above the limit', { drivenVehicleSpeed: KMH_ABOVE_LIMIT_IN_METERS_PER_SECOND }, OpenBlocker.VehicleMoving],
  ])('refuses and traces the reason when %s', (_situation, change, reason) => {
    const ports = watchedPorts()
    const store = readyStore()
    ports.game.setSituation(change)
    radialPress(ports, store, INPUT)
    expect(ports.nui.sent).toStrictEqual([])
    expect(linesOf(store, ReportKind.OpenRefused).map((line) => line.data)).toStrictEqual([{ reason }])
    expect(store.read().gesture.phase).toBe(GesturePhase.Idle)
  })

  it('refuses when no radial entry is registered', () => {
    const ports = watchedPorts()
    const store = storeWith()
    radialPress(ports, store, INPUT)
    expect(linesOf(store, ReportKind.OpenRefused).map((line) => line.data)).toStrictEqual([{ reason: OpenBlocker.NoRadialEntry }])
  })

  it('lets a passenger open', () => {
    const ports = watchedPorts()
    ports.game.setSituation({ drivenVehicleSpeed: null })
    radialPress(ports, readyStore(), INPUT)
    expect(ports.nui.sent).toStrictEqual([{ type: ToPage.OpenRadial }])
  })
})

describe('startIdleTick', () => {
  it('starts the idle tick when the pad gesture is on', () => {
    const ports = watchedPorts()
    startIdleTick(ports, INPUT)
    expect(ports.idle.isRunning()).toBe(true)
  })

  it('leaves it stopped when the pad gesture is off', () => {
    const ports = watchedPorts()
    startIdleTick(ports, { ...INPUT, padHoldGesture: false })
    expect(ports.idle.isRunning()).toBe(false)
  })
})

describe('idleFrame and the pad gesture on control 0', () => {
  function pressView(ports: ReturnType<typeof watchedPorts>, store: ReturnType<typeof storeWith>): void {
    ports.controls.setUsingKeyboard(false)
    ports.controls.pressControl(VIEW_CONTROL)
    idleFrame(ports, store, INPUT)
  }

  it('arms the hold, blocks control 0 from the press frame and starts the pump', () => {
    const ports = watchedPorts()
    const store = readyStore()
    pressView(ports, store)
    expect(store.read().gesture.phase).toBe(GesturePhase.Pressed)
    expect(ports.controls.disabledThisFrame).toStrictEqual([{ group: ControlGroup.Main, control: VIEW_CONTROL }])
    expect(ports.pump.isRunning()).toBe(true)
    expect(ports.nui.sent).toStrictEqual([{ type: ToPage.Modality, modality: Modality.Gamepad }])
  })

  it('ignores control 0 in keyboard modality, where it is V', () => {
    const ports = watchedPorts()
    const store = readyStore()
    ports.controls.pressControl(VIEW_CONTROL)
    idleFrame(ports, store, INPUT)
    expect(store.read().gesture.phase).toBe(GesturePhase.Idle)
    expect(ports.controls.disabledThisFrame).toStrictEqual([])
  })

  it('opens when the hold reaches the threshold, keeping control 0 blocked', () => {
    const ports = watchedPorts()
    const store = readyStore()
    pressView(ports, store)
    ports.controls.endFrame()
    ports.clock.advance(INPUT.padHoldMs - 1)
    pumpFrame(ports, store, INPUT)
    expect(ports.nui.sentOfType(ToPage.OpenRadial)).toStrictEqual([])
    expect(ports.controls.disabledThisFrame).toContainEqual({ group: ControlGroup.Main, control: VIEW_CONTROL })
    ports.controls.endFrame()
    ports.clock.advance(1)
    pumpFrame(ports, store, INPUT)
    expect(ports.nui.sentOfType(ToPage.OpenRadial)).toHaveLength(1)
    expect(ports.controls.disabledThisFrame).toContainEqual({ group: ControlGroup.Main, control: VIEW_CONTROL })
  })

  it('keeps control 0 blocked after the opening until View is released', () => {
    const ports = watchedPorts()
    const store = readyStore()
    pressView(ports, store)
    ports.clock.advance(INPUT.padHoldMs)
    pumpFrame(ports, store, INPUT)
    ports.controls.endFrame()
    pumpFrame(ports, store, INPUT)
    expect(store.read().gesture).toStrictEqual({ phase: GesturePhase.Held, modality: Modality.Gamepad })
    expect(ports.controls.disabledThisFrame).toContainEqual({ group: ControlGroup.Main, control: VIEW_CONTROL })
    ports.controls.endFrame()
    ports.controls.releaseControl(VIEW_CONTROL)
    pumpFrame(ports, store, INPUT)
    expect(store.read().gesture.phase).toBe(GesturePhase.Idle)
    expect(ports.controls.disabledThisFrame).toContainEqual({ group: ControlGroup.Main, control: VIEW_CONTROL })
    expect(ports.nui.sentOfType(ToPage.OpenRadial)).toHaveLength(1)
  })

  it('never blocks control 0 for a keyboard gesture', () => {
    const ports = watchedPorts()
    const store = readyStore()
    radialPress(ports, store, INPUT)
    pumpFrame(ports, store, INPUT)
    expect(ports.controls.disabledThisFrame).toStrictEqual([])
    expect(store.read().gesture.phase).toBe(GesturePhase.Held)
  })

  it('replays the next view on a short press, then reads it back and traces cameraReplayed', () => {
    const ports = watchedPorts()
    const store = readyStore()
    pressView(ports, store)
    ports.controls.endFrame()
    ports.clock.advance(INPUT.padHoldMs - 1)
    ports.controls.releaseControl(VIEW_CONTROL)
    pumpFrame(ports, store, INPUT)
    expect(ports.camera.writes).toStrictEqual([{ context: 0, mode: 1 }])
    expect(linesOf(store, ReportKind.CameraReplayed).map((line) => line.data)).toStrictEqual([{ context: 0, before: 0, expected: 1, actual: 1 }])
    expect(ports.controls.disabledThisFrame).toContainEqual({ group: ControlGroup.Main, control: VIEW_CONTROL })
    expect(ports.nui.sentOfType(ToPage.OpenRadial)).toStrictEqual([])
    expect(ports.pump.isRunning()).toBe(false)
  })

  it('skips the views the server forbids', () => {
    const ports = watchedPorts()
    const store = readyStore()
    pressView(ports, store)
    ports.controls.releaseControl(VIEW_CONTROL)
    pumpFrame(ports, store, { ...INPUT, cameraSkippedModes: [1] })
    expect(ports.camera.writes).toStrictEqual([{ context: 0, mode: 2 }])
  })

  it('does not block control 0 when the opening is refused at the press', () => {
    const ports = watchedPorts()
    const store = readyStore()
    ports.game.setSituation({ screenFaded: true })
    pressView(ports, store)
    expect(ports.controls.disabledThisFrame).toStrictEqual([])
    expect(store.read().gesture.phase).toBe(GesturePhase.Idle)
    expect(linesOf(store, ReportKind.OpenRefused)).toHaveLength(1)
  })

  it('treats the press as the command during a pause', () => {
    const ports = watchedPorts()
    const store = storeWith({ registry: REGISTRY_WITH_RADIAL_ENTRY, mode: UiMode.Panels, paused: true, modality: Modality.Gamepad })
    pressView(ports, store)
    expect(store.read().paused).toBe(false)
    expect(ports.nui.focusChanges).toStrictEqual([{ focus: true, cursor: false }])
  })

  it('does nothing while a menu is open and not paused', () => {
    const ports = watchedPorts()
    const store = storeWith({ registry: REGISTRY_WITH_RADIAL_ENTRY, mode: UiMode.Radial })
    pressView(ports, store)
    expect(store.read().gesture.phase).toBe(GesturePhase.Idle)
    expect(ports.nui.sent).toStrictEqual([])
  })

  it('ignores the keyboard release while the pad gesture is held', () => {
    const ports = watchedPorts()
    const store = readyStore()
    pressView(ports, store)
    radialRelease(ports, store, INPUT)
    expect(store.read().gesture.phase).toBe(GesturePhase.Pressed)
  })

  it('prints a failing tick to the console and keeps the tick alive', () => {
    const ports = watchedPorts()
    ports.idle.start()
    const brokenControls = { ...ports, controls: { ...ports.controls, isJustPressed: (): never => { throw new Error('native gone') } } }
    expect(() => idleFrame(brokenControls, readyStore(), INPUT)).not.toThrow()
    expect(ports.console.printed).toHaveLength(1)
    expect(ports.idle.isRunning()).toBe(true)
  })
})
