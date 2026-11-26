import { CloseReason } from '@openmemorykit/ui/contract'
import { IntentPhase } from '../../protocol/intents'
import { FromPage } from '../../protocol/from-page'
import { UiMode } from '../../protocol/page-vocabulary'
import type { PageEvent, StackSnapshot } from '../../protocol/stack'
import { expireToastQueue } from './client-messages'
import { BACK_HOLD_MS, checkBackHold } from './hold-detector'
import { routeInput } from './input-routing'
import { repeatSchedule } from './intent-input'
import { closeAllFrames } from './navigation'
import { PageCommandType, TimerKind, type TimerFiredCommand } from './page-commands'
import { handleList } from './panel-handlers'
import { dueRepeats } from './repeat-policy'
import { pageEvent } from './page-event'
import { schedule, sendToHost, stackEvent, unchanged, UiEffectType, withEffects, type CommandHandler, type Transition, type UiEffect } from './ui-effects'
import type { UiState } from './ui-state'
import { endWaiting } from './waiting-handler'

function fireBackHold(state: UiState, now: number): Transition {
  const { backHold } = state
  if (state.paused || state.mode === UiMode.Idle || backHold.pressedAt === null || backHold.fired) return unchanged(state)
  const check = checkBackHold(backHold, now)
  if (!check.fired) return withEffects(state, Number.isFinite(now) ? [schedule(TimerKind.BackHold, backHold.pressedAt + BACK_HOLD_MS - now)] : [])
  const closed = closeAllFrames({ ...state, backHold: check.hold }, CloseReason.CloseAll)
  const idle = { ...closed.state, mode: UiMode.Idle, escapeHeld: state.backFromEscape }
  return withEffects(idle, state.stack.length === 0 ? [] : [stackEvent(idle, closed.replies)])
}

function eventOf(effect: UiEffect): PageEvent | null {
  return effect.type === UiEffectType.SendToHost && effect.message.type === FromPage.Event ? effect.message.event : null
}

function withSingleEvent(effects: readonly UiEffect[]): readonly UiEffect[] {
  const pageEvents = effects.flatMap((effect) => eventOf(effect) ?? [])
  if (pageEvents.length <= 1) return effects
  const stack = pageEvents.reduce<StackSnapshot | null>((latest, event) => event.stack ?? latest, null)
  const merged = sendToHost(pageEvent(stack, pageEvents.flatMap((event) => event.replies)))
  const firstIndex = effects.findIndex((effect) => eventOf(effect) !== null)
  return effects.flatMap((effect, index) => (eventOf(effect) === null ? [effect] : index === firstIndex ? [merged] : []))
}

function fireRepeats(state: UiState, now: number): Transition {
  const due = dueRepeats(state.held, now)
  const start: Transition = unchanged(due.held === state.held ? state : { ...state, held: due.held })
  const repeated = due.repeats.reduce<Transition>((previous, intent) => {
    const routed = routeInput(previous.state, { type: PageCommandType.LocalIntent, intent, phase: IntentPhase.Press, fromEscape: false }, now)
    return { state: routed.state, effects: previous.effects.concat(routed.effects) }
  }, start)
  return withEffects(repeated.state, withSingleEvent(repeated.effects).concat(repeatSchedule(repeated.state, now)))
}

export const handleTimerFired: CommandHandler<TimerFiredCommand> = (state, command, now) => {
  switch (command.timer) {
    case TimerKind.ToastExpiry:
      return expireToastQueue(state, now)
    case TimerKind.BackHold:
      return fireBackHold(state, now)
    case TimerKind.Repeat:
      return fireRepeats(state, now)
    case TimerKind.WaitingTimeout:
      return endWaiting(state)
    case TimerKind.FormTimeout:
    case TimerKind.LinkPending:
      return handleList(state, command, now)
    default:
      return unchanged(state)
  }
}
