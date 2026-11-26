import { CloseReason } from '@openmemorykit/ui/contract'
import { IntentPhase } from '../../protocol/intents'
import { UiMode } from '../../protocol/page-vocabulary'
import { expireToastQueue } from './client-messages'
import { BACK_HOLD_MS, checkBackHold } from './hold-detector'
import { routeInput } from './input-routing'
import { repeatSchedule } from './intent-input'
import { closeAllFrames } from './navigation'
import { PageCommandType, TimerKind, type TimerFiredCommand } from './page-commands'
import { handleList } from './panel-handlers'
import { dueRepeats } from './repeat-policy'
import { schedule, stackEvent, unchanged, withEffects, type CommandHandler, type Transition } from './ui-effects'
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

function fireRepeats(state: UiState, now: number): Transition {
  const due = dueRepeats(state.held, now)
  const start: Transition = unchanged(due.held === state.held ? state : { ...state, held: due.held })
  const repeated = due.repeats.reduce<Transition>((previous, intent) => {
    const routed = routeInput(previous.state, { type: PageCommandType.LocalIntent, intent, phase: IntentPhase.Press, fromEscape: false }, now)
    return { state: routed.state, effects: previous.effects.concat(routed.effects) }
  }, start)
  return withEffects(repeated.state, repeated.effects.concat(repeatSchedule(repeated.state, now)))
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
