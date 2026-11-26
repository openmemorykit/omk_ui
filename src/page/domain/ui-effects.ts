import type { ValueOf } from '@openmemorykit/core/shared'
import type { FromPageMessage } from '../../protocol/from-page'
import type { OwnedReply } from '../../protocol/stack'
import type { TimerKind } from './page-commands'
import { pageEvent, stackSnapshot } from './page-event'
import type { UiState } from './ui-state'

export const UiEffectType = {
  SendToHost: 'sendToHost',
  Schedule: 'schedule',
  CancelSchedule: 'cancelSchedule',
  Announce: 'announce',
  FocusTextInput: 'focusTextInput',
  MeasurePaint: 'measurePaint',
} as const
export type UiEffectType = ValueOf<typeof UiEffectType>

export const Announcement = { PanelOpened: 'panelOpened', ItemFocused: 'itemFocused', FormErrors: 'formErrors' } as const
export type Announcement = ValueOf<typeof Announcement>

export type UiEffect =
  | { readonly type: typeof UiEffectType.SendToHost; readonly message: FromPageMessage }
  | { readonly type: typeof UiEffectType.Schedule; readonly timer: ValueOf<typeof TimerKind>; readonly delayMs: number }
  | { readonly type: typeof UiEffectType.CancelSchedule; readonly timer: ValueOf<typeof TimerKind> }
  | { readonly type: typeof UiEffectType.Announce; readonly announcement: ValueOf<typeof Announcement>; readonly params: Readonly<Record<string, string | number>> }
  | { readonly type: typeof UiEffectType.FocusTextInput; readonly itemId: string }
  | { readonly type: typeof UiEffectType.MeasurePaint; readonly panelId: string }

export interface Transition { readonly state: UiState; readonly effects: readonly UiEffect[] }

export type CommandHandler<Command> = (state: UiState, command: Command, now: number) => Transition

const NO_EFFECTS: readonly UiEffect[] = Object.freeze([])
const NO_DELAY = 0

export function unchanged(state: UiState): Transition {
  return { state, effects: NO_EFFECTS }
}

export function sendToHost(message: FromPageMessage): UiEffect {
  return { type: UiEffectType.SendToHost, message }
}

export function schedule(timer: TimerKind, delayMs: number): UiEffect {
  return { type: UiEffectType.Schedule, timer, delayMs: Math.max(NO_DELAY, delayMs) }
}

export function cancelSchedule(timer: TimerKind): UiEffect {
  return { type: UiEffectType.CancelSchedule, timer }
}

export function stackEvent(state: UiState, replies: readonly OwnedReply[]): UiEffect {
  return sendToHost(pageEvent(stackSnapshot(state), replies))
}

export function withEffects(state: UiState, effects: readonly UiEffect[]): Transition {
  return effects.length === 0 ? { state, effects: NO_EFFECTS } : { state, effects }
}
