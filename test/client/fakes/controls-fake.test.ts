import { describe, expect, it } from 'vitest'
import { ControlGroup } from '../../../src/client/domain/focus-policy'
import { PadControl } from '../../../src/client/domain/pad-snapshot'
import { createControlsFake, NEUTRAL_PAD, UNBOUND_LABEL } from './controls-fake'

const RADIAL_COMMAND = '+omk_ui_radial'
const F1_LABEL = 'b_170'
const PUSH_TO_TALK = 249

describe('ControlsPort fake', () => {
  it('reads a neutral pad on keyboard and mouse until told otherwise', () => {
    const controls = createControlsFake()
    expect(controls.readPad()).toBe(NEUTRAL_PAD)
    expect(controls.isUsingKeyboard()).toBe(true)
    const reading = { held: new Set([PadControl.FrontendAccept]), stick: { x: 1, y: 0 } }
    controls.setPad(reading)
    controls.setUsingKeyboard(false)
    expect(controls.readPad()).toBe(reading)
    expect(controls.isUsingKeyboard()).toBe(false)
  })

  it('reports a pressed control as just pressed for one frame and held until released', () => {
    const controls = createControlsFake()
    controls.pressControl(PadControl.NextCamera)
    expect(controls.isJustPressed(PadControl.NextCamera)).toBe(true)
    controls.endFrame()
    expect(controls.isJustPressed(PadControl.NextCamera)).toBe(false)
    expect(controls.isDisabledPressed(PadControl.NextCamera)).toBe(true)
    controls.releaseControl(PadControl.NextCamera)
    expect(controls.isDisabledPressed(PadControl.NextCamera)).toBe(false)
  })

  it('keeps what was disabled, enabled and suppressed during the current frame only', () => {
    const controls = createControlsFake()
    controls.disableAll()
    controls.disable(ControlGroup.Frontend, PadControl.FrontendPause)
    controls.enable(ControlGroup.Main, PUSH_TO_TALK)
    controls.suppressPauseMenu()
    expect(controls.allDisabledThisFrame).toBe(true)
    expect(controls.disabledThisFrame).toStrictEqual([{ group: ControlGroup.Frontend, control: PadControl.FrontendPause }])
    expect(controls.enabledThisFrame).toStrictEqual([{ group: ControlGroup.Main, control: PUSH_TO_TALK }])
    expect(controls.pauseMenuSuppressedThisFrame).toBe(true)
    controls.endFrame()
    expect([controls.allDisabledThisFrame, controls.disabledThisFrame, controls.enabledThisFrame, controls.pauseMenuSuppressedThisFrame]).toStrictEqual([false, [], [], false])
    expect(controls.calls.map((call) => call.args)).toStrictEqual([[], [ControlGroup.Frontend, PadControl.FrontendPause], [ControlGroup.Main, PUSH_TO_TALK], []])
  })

  it('reads the labels it was given, and a placeholder for an unbound command', () => {
    const controls = createControlsFake()
    expect(controls.bindingLabel(RADIAL_COMMAND)).toBe(UNBOUND_LABEL)
    expect(controls.pushToTalkLabel()).toBe(UNBOUND_LABEL)
    controls.setBindingLabel(RADIAL_COMMAND, F1_LABEL)
    controls.setPushToTalkLabel(F1_LABEL)
    expect(controls.bindingLabel(RADIAL_COMMAND)).toBe(F1_LABEL)
    expect(controls.pushToTalkLabel()).toBe(F1_LABEL)
  })
})
