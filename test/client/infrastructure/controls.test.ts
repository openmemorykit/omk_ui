import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FailureHandler } from '../../../src/shared/guarded-call'
import { createControlsPort } from '../../../src/client/infrastructure/controls'
import { ControlGroup } from '../../../src/client/domain/focus-policy'
import { PAD_INTENTS, PadControl } from '../../../src/client/domain/pad-snapshot'

const SIGNED_FLAG = 0x80000000
const RADIAL_HASH = 0x1234
const PUSH_TO_TALK = 249
const BACK_MENU_CONTROL = 244
const INTERACT = 51
const PAD_CONTROL_COUNT = 12
const AXIS_X = 195
const AXIS_Y = 196
const KEYBOARD_PAD_INDEX = 2
const PAUSE_CONTROL = 199
const FAILING_CALLS = 10
const CONTROL_ARGUMENTS = 2
const STICK_X = 0.5
const STICK_Y = -0.75
const LETTER_LABEL = 't_G'
const FUNCTION_KEY_LABEL = 'b_170'

let natives: NativeRecorder

function pressedOn(held: ReadonlyArray<readonly [number, number]>): (group: number, control: number) => boolean {
  return (group, control) => held.some(([heldGroup, heldControl]) => heldGroup === group && heldControl === control)
}

afterEach(() => natives.restore())

describe('controls port: reading', () => {
  it('reads the 12 pad controls of 5.3 with IsDisabledControlPressed, and axes 195 and 196', () => {
    natives = installNatives({
      IsDisabledControlPressed: pressedOn([[ControlGroup.Main, PadControl.NextCamera], [ControlGroup.Frontend, PadControl.FrontendAccept]]),
      GetDisabledControlNormal: (group: number, control: number) => (group === ControlGroup.Frontend ? control === AXIS_X ? STICK_X : STICK_Y : 0),
    })
    const reading = createControlsPort(vi.fn()).readPad()
    expect([...reading.held].sort()).toEqual([PadControl.NextCamera, PadControl.FrontendAccept].sort())
    expect(reading.stick).toEqual({ x: STICK_X, y: STICK_Y })
    const readControls = new Set(natives.callsOf('IsDisabledControlPressed').map(([, control]) => control))
    expect(readControls).toEqual(new Set(PAD_INTENTS.map(([control]) => control)))
    expect(readControls.size).toBe(PAD_CONTROL_COUNT)
    expect(natives.callsOf('GetDisabledControlNormal').map(([, control]) => control)).toEqual([AXIS_X, AXIS_X, AXIS_Y, AXIS_Y])
  })

  it('never reads or blocks control 244, the Back menu control', () => {
    natives = installNatives({
      IsDisabledControlPressed: () => false,
      IsDisabledControlJustPressed: () => false,
      GetDisabledControlNormal: () => 0,
      DisableControlAction: () => undefined,
      DisableAllControlActions: () => undefined,
    })
    const controls = createControlsPort(vi.fn())
    controls.readPad()
    controls.isJustPressed(PadControl.NextCamera)
    controls.isDisabledPressed(INTERACT)
    controls.disableAll()
    const touched = natives.calls.flatMap((call) => call.args.slice(0, CONTROL_ARGUMENTS))
    expect(touched).not.toContain(BACK_MENU_CONTROL)
  })

  it('reads control 0, 51 and 249 on instance 0 only, the frontend controls on 0 and 2', () => {
    natives = installNatives({ IsDisabledControlPressed: () => false, IsDisabledControlJustPressed: () => false })
    const controls = createControlsPort(vi.fn())
    controls.isDisabledPressed(PadControl.NextCamera)
    controls.isJustPressed(INTERACT)
    controls.isDisabledPressed(PUSH_TO_TALK)
    controls.isDisabledPressed(PadControl.FrontendCancel)
    expect(natives.calls.map((call) => call.args)).toEqual([
      [ControlGroup.Main, PadControl.NextCamera],
      [ControlGroup.Main, INTERACT],
      [ControlGroup.Main, PUSH_TO_TALK],
      [ControlGroup.Main, PadControl.FrontendCancel],
      [ControlGroup.Frontend, PadControl.FrontendCancel],
    ])
  })

  it('reads the just pressed state with IsDisabledControlJustPressed', () => {
    natives = installNatives({ IsDisabledControlJustPressed: pressedOn([[ControlGroup.Main, PadControl.NextCamera]]) })
    const controls = createControlsPort(vi.fn())
    expect(controls.isJustPressed(PadControl.NextCamera)).toBe(true)
    expect(controls.isJustPressed(INTERACT)).toBe(false)
  })

  it('asks IsUsingKeyboard on pad index 2 for the modality', () => {
    natives = installNatives({ IsUsingKeyboard: () => false })
    expect(createControlsPort(vi.fn()).isUsingKeyboard()).toBe(false)
    expect(natives.callsOf('IsUsingKeyboard')).toEqual([[KEYBOARD_PAD_INDEX]])
  })
})

describe('controls port: blocking', () => {
  it('disables everything on instance 0, blocks and re-enables single controls, and hides the pause menu', () => {
    natives = installNatives({ DisableAllControlActions: () => undefined, DisableControlAction: () => undefined, EnableControlAction: () => undefined, SetPauseMenuActive: () => undefined })
    const controls = createControlsPort(vi.fn())
    controls.disableAll()
    controls.disable(ControlGroup.Frontend, PAUSE_CONTROL)
    controls.disable(ControlGroup.Main, PAUSE_CONTROL)
    controls.enable(ControlGroup.Main, PUSH_TO_TALK)
    controls.suppressPauseMenu()
    expect(natives.calls.map((call) => [call.name, ...call.args])).toEqual([
      ['DisableAllControlActions', ControlGroup.Main],
      ['DisableControlAction', ControlGroup.Frontend, PAUSE_CONTROL, true],
      ['DisableControlAction', ControlGroup.Main, PAUSE_CONTROL, true],
      ['EnableControlAction', ControlGroup.Main, PUSH_TO_TALK, true],
      ['SetPauseMenuActive', false],
    ])
  })
})

describe('controls port: binding labels', () => {
  it('hashes the command with GetHashKey and sets the 0x80000000 flag, without unsigning it', () => {
    natives = installNatives({ GetHashKey: () => RADIAL_HASH, GetControlInstructionalButton: () => FUNCTION_KEY_LABEL })
    expect(createControlsPort(vi.fn()).bindingLabel('+omk_ui_radial')).toBe(FUNCTION_KEY_LABEL)
    expect(natives.callsOf('GetHashKey')).toEqual([['+omk_ui_radial']])
    const [padIndex, hashed, keyboardOnly] = natives.callsOf('GetControlInstructionalButton')[0] ?? []
    expect([padIndex, keyboardOnly]).toEqual([0, true])
    expect(hashed).toBe(RADIAL_HASH | SIGNED_FLAG)
    expect(hashed).toBeLessThan(0)
  })

  it('keeps a letter label with its t_ prefix and a function key label with its b_ prefix', () => {
    const labels = [LETTER_LABEL, FUNCTION_KEY_LABEL]
    natives = installNatives({ GetHashKey: () => RADIAL_HASH, GetControlInstructionalButton: () => labels.shift() })
    const controls = createControlsPort(vi.fn())
    expect(controls.bindingLabel('+omk_ui_interact')).toBe(LETTER_LABEL)
    expect(controls.bindingLabel('+omk_ui_radial')).toBe(FUNCTION_KEY_LABEL)
  })

  it('reads the label of control 249 on instance 0, keyboard side, without hashing', () => {
    natives = installNatives({ GetControlInstructionalButton: () => LETTER_LABEL })
    expect(createControlsPort(vi.fn()).pushToTalkLabel()).toBe(LETTER_LABEL)
    expect(natives.callsOf('GetControlInstructionalButton')).toEqual([[0, PUSH_TO_TALK, true]])
  })
})

describe('controls port: failures', () => {
  it('keeps native failures out of the caller, falls back to a neutral value and reports each one', () => {
    const throwing = (): never => { throw new Error('native failed') }
    natives = installNatives({
      IsDisabledControlPressed: throwing,
      IsDisabledControlJustPressed: throwing,
      IsUsingKeyboard: throwing,
      DisableAllControlActions: throwing,
      DisableControlAction: throwing,
      EnableControlAction: throwing,
      SetPauseMenuActive: throwing,
      GetHashKey: throwing,
      GetControlInstructionalButton: throwing,
    })
    const onFailure = vi.fn<FailureHandler>()
    const controls = createControlsPort(onFailure)
    const reading = controls.readPad()
    expect(reading.held.size).toBe(0)
    expect(reading.stick).toEqual({ x: 0, y: 0 })
    expect([controls.isUsingKeyboard(), controls.isJustPressed(0), controls.isDisabledPressed(0)]).toEqual([true, false, false])
    expect(() => {
      controls.disableAll()
      controls.disable(ControlGroup.Main, 1)
      controls.enable(ControlGroup.Main, 1)
      controls.suppressPauseMenu()
    }).not.toThrow()
    expect([controls.bindingLabel('+omk_ui_radial'), controls.pushToTalkLabel()]).toEqual(['', ''])
    expect(onFailure).toHaveBeenCalledTimes(FAILING_CALLS)
  })
})
