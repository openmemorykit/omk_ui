import type { ControlsPort } from '../../../src/client/application/ports'
import type { ControlRef } from '../../../src/client/domain/focus-policy'
import type { PadControl, PadReading } from '../../../src/client/domain/pad-snapshot'
import type { PortCall } from '../../shared/fakes/port-call'

export const UNBOUND_LABEL = 'unbound'
export const NEUTRAL_PAD: PadReading = Object.freeze({ held: new Set<PadControl>(), stick: Object.freeze({ x: 0, y: 0 }) })

export interface ControlsFake extends ControlsPort {
  readonly calls: readonly PortCall<ControlsPort>[]
  readonly allDisabledThisFrame: boolean
  readonly disabledThisFrame: readonly ControlRef[]
  readonly enabledThisFrame: readonly ControlRef[]
  readonly pauseMenuSuppressedThisFrame: boolean
  setPad(reading: PadReading): void
  setUsingKeyboard(using: boolean): void
  pressControl(control: number): void
  releaseControl(control: number): void
  endFrame(): void
  setBindingLabel(command: string, label: string): void
  setPushToTalkLabel(label: string): void
}

interface FrameEffects {
  allDisabled: boolean
  pauseMenuSuppressed: boolean
  readonly disabled: ControlRef[]
  readonly enabled: ControlRef[]
}

const freshFrame = (): FrameEffects => ({ allDisabled: false, pauseMenuSuppressed: false, disabled: [], enabled: [] })

export function createControlsFake(): ControlsFake {
  const calls: PortCall<ControlsPort>[] = []
  const held = new Set<number>()
  const justPressed = new Set<number>()
  const labels = new Map<string, string>()
  let pad = NEUTRAL_PAD
  let usingKeyboard = true
  let pushToTalkLabel = UNBOUND_LABEL
  let frame = freshFrame()
  const recorded = <Value>(call: PortCall<ControlsPort>, value: Value): Value => {
    calls.push(call)
    return value
  }
  return {
    readPad: () => recorded({ method: 'readPad', args: [] }, pad),
    isUsingKeyboard: () => recorded({ method: 'isUsingKeyboard', args: [] }, usingKeyboard),
    isJustPressed: (control) => recorded({ method: 'isJustPressed', args: [control] }, justPressed.has(control)),
    isDisabledPressed: (control) => recorded({ method: 'isDisabledPressed', args: [control] }, held.has(control)),
    disableAll() {
      frame.allDisabled = recorded({ method: 'disableAll', args: [] }, true)
    },
    disable(group, control) {
      frame.disabled.push(recorded({ method: 'disable', args: [group, control] }, { group, control }))
    },
    enable(group, control) {
      frame.enabled.push(recorded({ method: 'enable', args: [group, control] }, { group, control }))
    },
    suppressPauseMenu() {
      frame.pauseMenuSuppressed = recorded({ method: 'suppressPauseMenu', args: [] }, true)
    },
    bindingLabel: (command) => recorded({ method: 'bindingLabel', args: [command] }, labels.get(command) ?? UNBOUND_LABEL),
    pushToTalkLabel: () => recorded({ method: 'pushToTalkLabel', args: [] }, pushToTalkLabel),
    setPad(reading) {
      pad = reading
    },
    setUsingKeyboard(using) {
      usingKeyboard = using
    },
    pressControl(control) {
      held.add(control)
      justPressed.add(control)
    },
    releaseControl(control) {
      held.delete(control)
    },
    endFrame() {
      justPressed.clear()
      frame = freshFrame()
    },
    setBindingLabel(command, label) {
      labels.set(command, label)
    },
    setPushToTalkLabel(label) {
      pushToTalkLabel = label
    },
    calls,
    get allDisabledThisFrame() {
      return frame.allDisabled
    },
    get disabledThisFrame() {
      return frame.disabled
    },
    get enabledThisFrame() {
      return frame.enabled
    },
    get pauseMenuSuppressedThisFrame() {
      return frame.pauseMenuSuppressed
    },
  }
}
