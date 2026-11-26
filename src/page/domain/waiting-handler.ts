import { Intent, IntentPhase } from '../../protocol/intents'
import { UiMode } from '../../protocol/page-vocabulary'
import type { InputCommand } from './input-routing'
import { PageCommandType } from './page-commands'
import { unchanged, type CommandHandler, type Transition } from './ui-effects'
import type { UiState } from './ui-state'

export const handleWaiting: CommandHandler<InputCommand> = (state, command) => {
  const isBackPress = command.type === PageCommandType.LocalIntent && command.phase === IntentPhase.Press && command.intent === Intent.Back
  return isBackPress ? unchanged({ ...state, mode: UiMode.Idle, escapeHeld: command.fromEscape }) : unchanged(state)
}

export function endWaiting(state: UiState): Transition {
  return unchanged(state.mode === UiMode.Waiting ? { ...state, mode: UiMode.Idle } : state)
}
