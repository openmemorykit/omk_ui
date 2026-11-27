import { afterEach, describe, expect, it } from 'vitest'
import { applyEscapeReleased, applyModeChanged, applyPaused } from '../../../src/client/application/apply-focus'
import { FocusReleaseReason } from '../../../src/client/application/release-focus'
import { pumpFrame } from '../../../src/client/application/pump-inputs'
import { ControlGroup } from '../../../src/client/domain/focus-policy'
import { PadControl } from '../../../src/client/domain/pad-snapshot'
import { GuardedControl, GuardEnd, GuardKind, RELEASE_GUARD_CAP_MS } from '../../../src/client/domain/release-guard'
import { Modality } from '../../../src/protocol/intents'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { INPUT_DEFAULTS } from '../../../src/shared/config/config-schema'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { NEUTRAL_PAD } from '../fakes/controls-fake'
import type { ClientPortsFake } from '../fakes/client-ports-fake'
import { expectKeepInputNeverTurnedOn, linesOf, storeWith, watchedPorts } from './watched-ports'

const NOW = 1000
const PAD_GUARDED = [GuardedControl.FrontendPause, GuardedControl.FrontendPauseAlternate, GuardedControl.FrontendEscape, GuardedControl.FrontendCancel, GuardedControl.FrontendBack]

afterEach(expectKeepInputNeverTurnedOn)

function everyGroup(controls: readonly number[]): readonly { group: number; control: number }[] {
  return controls.flatMap((control) => [ControlGroup.Main, ControlGroup.Frontend].map((group) => ({ group, control })))
}

function closedByPad(ports: ClientPortsFake, control: PadControl): ReturnType<typeof storeWith> {
  const store = storeWith({ mode: UiMode.Panels, modality: Modality.Gamepad })
  ports.controls.setUsingKeyboard(false)
  ports.controls.setPad({ ...NEUTRAL_PAD, held: new Set([control]) })
  ports.controls.pressControl(control)
  applyModeChanged(ports, store, { mode: UiMode.Idle })
  ports.controls.endFrame()
  return store
}

function closedByEscape(ports: ClientPortsFake): ReturnType<typeof storeWith> {
  const store = storeWith({ mode: UiMode.Panels })
  applyModeChanged(ports, store, { mode: UiMode.Idle, escapeHeld: true })
  return store
}

describe('release guard after a pad close (Start, B, View)', () => {
  it('gives the focus back at once and blocks the guarded controls until B is released', () => {
    const ports = watchedPorts(NOW)
    const store = closedByPad(ports, PadControl.FrontendCancel)
    expect(ports.nui.focusChanges).toStrictEqual([{ focus: false, cursor: false }])
    expect(linesOf(store, ReportKind.ReleaseGuard).map((line) => line.data)).toStrictEqual([{ active: true, guard: GuardKind.Pad }])
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.controls.disabledThisFrame).toStrictEqual(everyGroup(PAD_GUARDED))
    expect(ports.controls.allDisabledThisFrame).toBe(false)
    ports.controls.endFrame()
    ports.controls.releaseControl(PadControl.FrontendCancel)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(store.read().guard.kind).toBe(GuardKind.None)
    expect(linesOf(store, ReportKind.ReleaseGuard).at(-1)?.data).toStrictEqual({ active: false, guard: GuardEnd.Released })
    expect(ports.pump.isRunning()).toBe(false)
  })

  it('blocks control 0 as well when View closed', () => {
    const ports = watchedPorts(NOW)
    const store = closedByPad(ports, PadControl.NextCamera)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.controls.disabledThisFrame).toStrictEqual(everyGroup([...PAD_GUARDED, 0]))
  })

  it('guards Start the same way', () => {
    const ports = watchedPorts(NOW)
    const store = closedByPad(ports, PadControl.FrontendPause)
    expect(store.read().guard).toStrictEqual({ kind: GuardKind.Pad, closingControl: PadControl.FrontendPause, startedAt: NOW })
  })

  it('stops at the 2 s cap even if the control stays held', () => {
    const ports = watchedPorts(NOW)
    const store = closedByPad(ports, PadControl.FrontendPause)
    ports.clock.advance(RELEASE_GUARD_CAP_MS)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(store.read().guard.kind).toBe(GuardKind.None)
    expect(linesOf(store, ReportKind.ReleaseGuard).at(-1)?.data).toStrictEqual({ active: false, guard: GuardEnd.Capped })
  })

  it('does not turn the blur that follows the close into PageBlurred', () => {
    const ports = watchedPorts(NOW)
    const store = closedByPad(ports, PadControl.NextCamera)
    applyPaused(ports, store, true)
    expect(store.read().guard.kind).toBe(GuardKind.Pad)
    expect(store.read().paused).toBe(false)
    expect(linesOf(store, ReportKind.PagePaused)).toStrictEqual([])
  })

  it('starts no guard when no closing control is held any more', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels, modality: Modality.Gamepad })
    applyModeChanged(ports, store, { mode: UiMode.Idle })
    expect(store.read().guard.kind).toBe(GuardKind.None)
  })

  it('starts no pad guard in keyboard modality', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith({ mode: UiMode.Panels })
    ports.controls.setPad({ ...NEUTRAL_PAD, held: new Set([PadControl.FrontendCancel]) })
    applyModeChanged(ports, store, { mode: UiMode.Idle })
    expect(store.read().guard.kind).toBe(GuardKind.None)
  })
})

describe('waiting for the end of Escape', () => {
  it('keeps the focus without cursor, keepInput off, and blocks like Panels', () => {
    const ports = watchedPorts(NOW)
    const store = closedByEscape(ports)
    expect(ports.nui.focusChanges).toStrictEqual([{ focus: true, cursor: false }])
    expect(ports.nui.keepInputChanges).toStrictEqual([false])
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.controls.allDisabledThisFrame).toBe(true)
    expect(ports.pump.isRunning()).toBe(true)
  })

  it('gives the focus back at EscapeReleased', () => {
    const ports = watchedPorts(NOW)
    const store = closedByEscape(ports)
    applyEscapeReleased(ports, store)
    expect(ports.nui.focusChanges.at(-1)).toStrictEqual({ focus: false, cursor: false })
    expect(store.read().guard.kind).toBe(GuardKind.None)
    expect(linesOf(store, ReportKind.FocusApplied).at(-1)?.data).toMatchObject({ reason: FocusReleaseReason.EscapeReleased })
    expect(ports.pump.isRunning()).toBe(false)
  })

  it('gives the focus back at the page blur', () => {
    const ports = watchedPorts(NOW)
    const store = closedByEscape(ports)
    applyPaused(ports, store, true)
    expect(store.read().paused).toBe(false)
    expect(linesOf(store, ReportKind.ReleaseGuard).at(-1)?.data).toStrictEqual({ active: false, guard: GuardEnd.Blurred })
    expect(linesOf(store, ReportKind.FocusApplied).at(-1)?.data).toMatchObject({ reason: FocusReleaseReason.PageBlurred })
  })

  it('gives the focus back at the 2 s cap', () => {
    const ports = watchedPorts(NOW)
    const store = closedByEscape(ports)
    ports.clock.advance(RELEASE_GUARD_CAP_MS - 1)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(store.read().guard.kind).toBe(GuardKind.Escape)
    ports.clock.advance(1)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(linesOf(store, ReportKind.FocusApplied).at(-1)?.data).toMatchObject({ reason: FocusReleaseReason.EscapeWaitCapped })
    expect(ports.pump.isRunning()).toBe(false)
  })

  it('ignores EscapeReleased without a wait', () => {
    const ports = watchedPorts(NOW)
    const store = storeWith()
    applyEscapeReleased(ports, store)
    expect(ports.nui.focusChanges).toStrictEqual([])
  })

  it('drops the wait when a menu opens again', () => {
    const ports = watchedPorts(NOW)
    const store = closedByEscape(ports)
    applyModeChanged(ports, store, { mode: UiMode.Radial })
    expect(store.read().guard.kind).toBe(GuardKind.None)
  })
})
