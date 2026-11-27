import type { ControlsPort } from '../application/ports'
import { ControlGroup, PUSH_TO_TALK_CONTROL } from '../domain/focus-policy'
import { PAD_INTENTS, PadControl, type PadReading } from '../domain/pad-snapshot'
import { guardNative, type FailureReporter } from './native-guard'

const KEYBOARD_PAD_INDEX = 2
const SIGNED_BINDING_FLAG = 0x80000000
const INTERACT_CONTROL = 51
const BOTH_GROUPS: readonly ControlGroup[] = Object.freeze([ControlGroup.Main, ControlGroup.Frontend])
const MAIN_GROUP_ONLY: readonly ControlGroup[] = Object.freeze([ControlGroup.Main])
const GAMEPLAY_CONTROLS: ReadonlySet<number> = new Set([PadControl.NextCamera, INTERACT_CONTROL, PUSH_TO_TALK_CONTROL])
const PAD_BUTTON_CONTROLS: readonly PadControl[] = Object.freeze(PAD_INTENTS.map(([control]) => control))
const NEUTRAL_READING: PadReading = Object.freeze({ held: new Set<PadControl>(), stick: Object.freeze({ x: 0, y: 0 }) })

function groupsOf(control: number): readonly ControlGroup[] {
  return GAMEPLAY_CONTROLS.has(control) ? MAIN_GROUP_ONLY : BOTH_GROUPS
}

function isHeld(control: number): boolean {
  return groupsOf(control).some((group) => IsDisabledControlPressed(group, control))
}

function strongestAxis(control: number): number {
  return BOTH_GROUPS.map((group) => GetDisabledControlNormal(group, control)).reduce((best, value) => (Math.abs(value) > Math.abs(best) ? value : best), 0)
}

function readPad(): PadReading {
  return {
    held: new Set(PAD_BUTTON_CONTROLS.filter(isHeld)),
    stick: { x: strongestAxis(PadControl.FrontendAxisX), y: strongestAxis(PadControl.FrontendAxisY) },
  }
}

function readBindingLabel(command: string): string {
  return GetControlInstructionalButton(0, GetHashKey(command) | SIGNED_BINDING_FLAG, true)
}

export function createControlsPort(onFailure: FailureReporter): ControlsPort {
  const guard = <Result>(source: string, fallback: Result, action: () => Result): Result => guardNative(onFailure, `controls.${source}`, fallback, action)
  return {
    readPad: () => guard('readPad', NEUTRAL_READING, readPad),
    isUsingKeyboard: () => guard('isUsingKeyboard', true, () => IsUsingKeyboard(KEYBOARD_PAD_INDEX)),
    isJustPressed: (control) => guard('isJustPressed', false, () => groupsOf(control).some((group) => IsDisabledControlJustPressed(group, control))),
    isDisabledPressed: (control) => guard('isDisabledPressed', false, () => isHeld(control)),
    disableAll: () => guard('disableAll', undefined, () => DisableAllControlActions(ControlGroup.Main)),
    disable: (group, control) => guard('disable', undefined, () => DisableControlAction(group, control, true)),
    enable: (group, control) => guard('enable', undefined, () => EnableControlAction(group, control, true)),
    suppressPauseMenu: () => guard('suppressPauseMenu', undefined, () => SetPauseMenuActive(false)),
    bindingLabel: (command) => guard('bindingLabel', '', () => readBindingLabel(command)),
    pushToTalkLabel: () => guard('pushToTalkLabel', '', () => GetControlInstructionalButton(0, PUSH_TO_TALK_CONTROL, true)),
  }
}
