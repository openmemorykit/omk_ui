import { Intent, IntentPhase, Modality } from '../../protocol/intents'
import { FromPage } from '../../protocol/from-page'
import { UiMode } from '../../protocol/page-vocabulary'
import type { ToPage } from '../../protocol/to-page'
import { changeModality } from './client-messages'
import { BACK_HOLD_MS, pressBack } from './hold-detector'
import { routeInput, type InputCommand } from './input-routing'
import { derivedMode } from './mode-change'
import { PageCommandType, TimerKind, type LocalIntentCommand, type PageCommand, type UiCommandOf } from './page-commands'
import { nextRepeatAt, pressHeld } from './repeat-policy'
import { schedule, sendToHost, unchanged, withEffects, type CommandHandler, type Transition, type UiEffect } from './ui-effects'
import { releaseAllIntents, releaseIntent, type UiState } from './ui-state'

type CommandOf<Type extends PageCommand['type']> = Extract<PageCommand, { readonly type: Type }>

const isSafeCount = (value: number): boolean => Number.isSafeInteger(value) && value >= 0

export function repeatSchedule(state: UiState, now: number): readonly UiEffect[] {
  const next = nextRepeatAt(state.held)
  return next === null ? [] : [schedule(TimerKind.Repeat, next - now)]
}

function released(state: UiState, intent: Intent): Transition {
  const next = releaseIntent(state, intent)
  const clearsEscape = intent === Intent.Back && next.backFromEscape
  return unchanged(clearsEscape ? { ...next, backFromEscape: false } : next)
}

function pressed(state: UiState, command: LocalIntentCommand, now: number): Transition {
  const held = pressHeld(state.held, command.intent, now)
  const startsBackHold = command.intent === Intent.Back && state.backHold.pressedAt === null
  const next: UiState = startsBackHold ? { ...state, held, backHold: pressBack(now), backFromEscape: command.fromEscape } : { ...state, held }
  const backEffects: readonly UiEffect[] = startsBackHold ? [schedule(TimerKind.BackHold, BACK_HOLD_MS)] : []
  const repeatEffects = held === state.held ? [] : repeatSchedule(next, now)
  const routed = routeInput(next, command, now)
  const timers = derivedMode(routed.state) === UiMode.Idle ? [] : backEffects.concat(repeatEffects)
  return { state: routed.state, effects: timers.concat(routed.effects) }
}

export const handleLocalIntent: CommandHandler<LocalIntentCommand> = (state, command, now) => {
  if (command.phase === IntentPhase.Release) return released(state, command.intent)
  if (command.phase !== IntentPhase.Press || state.paused || state.mode === UiMode.Idle) return unchanged(state)
  return pressed(state, command, now)
}

export const handleClientIntent: CommandHandler<UiCommandOf<typeof ToPage.Intent>> = (state, message, now) => {
  const counted = isSafeCount(message.seq) ? { ...state, lastIntentSeq: message.seq, ackPending: true } : state
  return handleLocalIntent(counted, { type: PageCommandType.LocalIntent, intent: message.intent, phase: message.phase, fromEscape: false }, now)
}

export const handleInput: CommandHandler<InputCommand> = (state, command, now) => routeInput(state, command, now)

export const handleFrameTick: CommandHandler<CommandOf<typeof PageCommandType.FrameTick>> = (state) => {
  if (!state.ackPending) return unchanged(state)
  return withEffects({ ...state, ackPending: false }, [sendToHost({ type: FromPage.Ack, lastIntentSeq: state.lastIntentSeq })])
}

export const handleWindowBlurred: CommandHandler<CommandOf<typeof PageCommandType.WindowBlurred>> = (state) => {
  if (state.paused) return unchanged(state)
  return withEffects({ ...releaseAllIntents(state), paused: true, escapeHeld: false }, [sendToHost({ type: FromPage.Paused, paused: true })])
}

export const handleWindowFocused: CommandHandler<CommandOf<typeof PageCommandType.WindowFocused>> = (state) => {
  if (!state.paused) return unchanged(state)
  return withEffects({ ...state, paused: false }, [sendToHost({ type: FromPage.Paused, paused: false })])
}

export const handleLocalModality: CommandHandler<CommandOf<typeof PageCommandType.LocalModality>> = (state) => changeModality(state, Modality.KeyboardMouse)

export const handleEscapeKeyUp: CommandHandler<CommandOf<typeof PageCommandType.EscapeKeyUp>> = (state) => {
  if (!state.escapeHeld) return unchanged(state)
  return withEffects({ ...state, escapeHeld: false }, [sendToHost({ type: FromPage.EscapeReleased })])
}
