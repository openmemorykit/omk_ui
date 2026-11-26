import type { ValueOf } from '@openmemorykit/core/shared'

export const Intent = {
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
  Confirm: 'confirm',
  Back: 'back',
  TabNext: 'tabNext',
  TabPrev: 'tabPrev',
  Radial: 'radial',
  Erase: 'erase',
  Space: 'space',
  Submit: 'submit',
} as const
export type Intent = ValueOf<typeof Intent>

export const IntentPhase = { Press: 'press', Release: 'release' } as const
export type IntentPhase = ValueOf<typeof IntentPhase>

export const InputSource = { Keyboard: 'keyboard', Pointer: 'pointer', Pad: 'pad', Console: 'console' } as const
export type InputSource = ValueOf<typeof InputSource>

export interface IntentEvent {
  readonly intent: Intent
  readonly phase: IntentPhase
  readonly source: InputSource
}

export interface StickEvent {
  readonly x: number
  readonly y: number
}

export const Modality = { KeyboardMouse: 'keyboardMouse', Gamepad: 'gamepad' } as const
export type Modality = ValueOf<typeof Modality>
