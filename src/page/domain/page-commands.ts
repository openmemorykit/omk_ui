import type { ValueOf } from '@openmemorykit/core/shared'
import type { Intent, IntentPhase, StickEvent } from '../../protocol/intents'
import type { ToPageMessage } from '../../protocol/to-page'

export const PageCommandType = {
  LocalIntent: 'localIntent',
  LocalModality: 'localModality',
  HoverItem: 'hoverItem',
  ClickItem: 'clickItem',
  PointerAim: 'pointerAim',
  TypeText: 'typeText',
  FrameTick: 'frameTick',
  TimerFired: 'timerFired',
  WindowBlurred: 'windowBlurred',
  WindowFocused: 'windowFocused',
  EscapeKeyUp: 'escapeKeyUp',
} as const
export type PageCommandType = ValueOf<typeof PageCommandType>

export const TimerKind = {
  Repeat: 'repeat',
  BackHold: 'backHold',
  FormTimeout: 'formTimeout',
  WaitingTimeout: 'waitingTimeout',
  LinkPending: 'linkPending',
  ToastExpiry: 'toastExpiry',
} as const
export type TimerKind = ValueOf<typeof TimerKind>

export const WAITING_TIMEOUT_MS = 1000
export const LINK_PENDING_MS = 1000

export interface LocalIntentCommand {
  readonly type: typeof PageCommandType.LocalIntent
  readonly intent: Intent
  readonly phase: IntentPhase
  readonly fromEscape: boolean
}

export interface TimerFiredCommand { readonly type: typeof PageCommandType.TimerFired; readonly timer: ValueOf<typeof TimerKind> }

export type PageCommand =
  | LocalIntentCommand
  | { readonly type: typeof PageCommandType.LocalModality }
  | { readonly type: typeof PageCommandType.HoverItem; readonly itemId: string }
  | { readonly type: typeof PageCommandType.ClickItem; readonly itemId: string }
  | { readonly type: typeof PageCommandType.PointerAim; readonly vector: StickEvent | null }
  | { readonly type: typeof PageCommandType.TypeText; readonly value: string }
  | { readonly type: typeof PageCommandType.FrameTick }
  | TimerFiredCommand
  | { readonly type: typeof PageCommandType.WindowBlurred }
  | { readonly type: typeof PageCommandType.WindowFocused }
  | { readonly type: typeof PageCommandType.EscapeKeyUp }

export type UiCommand = ToPageMessage | PageCommand
export type UiCommandType = UiCommand['type']
export type UiCommandOf<Type extends UiCommandType> = Extract<UiCommand, { readonly type: Type }>
