import { describe, expect, it } from 'vitest'
import { Modality } from '../../../src/protocol/intents'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { ALWAYS_BLOCKED_CONTROLS, ControlGroup, decideFocus, PUSH_TO_TALK_CONTROL, PushToTalkPolicy } from '../../../src/client/domain/focus-policy'
import { GuardedControl, guardedControls, startPadGuard } from '../../../src/client/domain/release-guard'
import type { FocusContext } from '../../../src/client/domain/focus-policy'

const BASE: FocusContext = {
  mode: UiMode.Idle,
  modality: Modality.KeyboardMouse,
  paused: false,
  awaitingEscapeRelease: false,
  releaseGuardControls: [],
  textEntryActive: false,
  pushToTalk: PushToTalkPolicy.Blocked,
}

const ALL_BLOCKED = ALWAYS_BLOCKED_CONTROLS.flatMap((control) => [ControlGroup.Main, ControlGroup.Frontend].map((group) => ({ group, control })))

describe('decideFocus', () => {
  it('releases everything when idle', () => {
    expect(decideFocus(BASE)).toEqual({ focus: false, cursor: false, keepInput: false, disableAllControls: false, blocked: [], enabled: [], suppressPauseMenu: false })
  })

  it.each([UiMode.Radial, UiMode.Panels])('holds focus with a cursor for %s on keyboard', (mode) => {
    const decision = decideFocus({ ...BASE, mode })
    expect(decision).toMatchObject({ focus: true, cursor: true, keepInput: false, disableAllControls: true, suppressPauseMenu: true })
    expect(decision.blocked).toEqual(ALL_BLOCKED)
  })

  it('holds focus without cursor while waiting', () => {
    const decision = decideFocus({ ...BASE, mode: UiMode.Waiting })
    expect(decision).toMatchObject({ focus: true, cursor: false, keepInput: false, disableAllControls: true })
    expect(decision.blocked).toEqual(ALL_BLOCKED)
  })

  it.each([UiMode.Radial, UiMode.Panels])('holds focus without cursor for %s on gamepad', (mode) => {
    const decision = decideFocus({ ...BASE, mode, modality: Modality.Gamepad })
    expect(decision).toMatchObject({ focus: true, cursor: false, keepInput: false, disableAllControls: true })
    expect(decision.blocked).toEqual(ALL_BLOCKED)
  })

  it('gives focus back while paused, even when active', () => {
    expect(decideFocus({ ...BASE, mode: UiMode.Panels, paused: true })).toEqual({ focus: false, cursor: false, keepInput: null, disableAllControls: false, blocked: [], enabled: [], suppressPauseMenu: false })
  })

  it('gives focus back while paused and awaiting escape release', () => {
    expect(decideFocus({ ...BASE, paused: true, awaitingEscapeRelease: true }).focus).toBe(false)
  })

  it('holds focus without cursor while awaiting the escape release', () => {
    const decision = decideFocus({ ...BASE, awaitingEscapeRelease: true })
    expect(decision).toMatchObject({ focus: true, cursor: false, keepInput: false, disableAllControls: true, suppressPauseMenu: true })
    expect(decision.blocked).toEqual(ALL_BLOCKED)
  })

  it('blocks only the guard controls on both groups during a pad guard', () => {
    const decision = decideFocus({ ...BASE, releaseGuardControls: [GuardedControl.FrontendPause, 0] })
    expect(decision).toMatchObject({ focus: false, cursor: false, keepInput: false, disableAllControls: false, suppressPauseMenu: false })
    expect(decision.blocked).toEqual([
      { group: ControlGroup.Main, control: GuardedControl.FrontendPause },
      { group: ControlGroup.Frontend, control: GuardedControl.FrontendPause },
      { group: ControlGroup.Main, control: 0 },
      { group: ControlGroup.Frontend, control: 0 },
    ])
  })

  it('blocks the real controls of a pad guard closed with View', () => {
    const controls = guardedControls(startPadGuard(0, 0))
    const blocked = decideFocus({ ...BASE, releaseGuardControls: controls }).blocked
    expect(blocked.map((reference) => reference.control)).toEqual(controls.flatMap((control) => [control, control]))
  })

  it('reenables push to talk unless text entry is active', () => {
    const open = decideFocus({ ...BASE, mode: UiMode.Panels, pushToTalk: PushToTalkPolicy.Reenabled })
    expect(open.enabled).toEqual([{ group: ControlGroup.Main, control: PUSH_TO_TALK_CONTROL }])
    expect(decideFocus({ ...BASE, mode: UiMode.Panels, pushToTalk: PushToTalkPolicy.Reenabled, textEntryActive: true }).enabled).toEqual([])
  })

  it('never reenables push to talk when blocked', () => {
    expect(decideFocus({ ...BASE, mode: UiMode.Panels }).enabled).toEqual([])
  })

  it('ignores text entry when idle', () => {
    const quiet = decideFocus({ ...BASE, pushToTalk: PushToTalkPolicy.Reenabled })
    expect(decideFocus({ ...BASE, pushToTalk: PushToTalkPolicy.Reenabled, textEntryActive: true })).toEqual(quiet)
    expect(quiet.enabled).toEqual([])
  })

  it('does not mutate its input', () => {
    const context = Object.freeze({ ...BASE, releaseGuardControls: Object.freeze([GuardedControl.FrontendPause]) })
    expect(() => decideFocus(context)).not.toThrow()
  })

  it('survives a malformed guard control list', () => {
    const context = { ...BASE, releaseGuardControls: undefined } as unknown as FocusContext
    expect(decideFocus(context).blocked).toEqual([])
  })
})
