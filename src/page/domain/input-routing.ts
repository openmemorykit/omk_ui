import { UiMode } from '../../protocol/page-vocabulary'
import type { ToPage } from '../../protocol/to-page'
import type { PageCommandType, UiCommandOf } from './page-commands'
import { handleConfirmLayer, handleKeyboardLayer, handleList } from './panel-handlers'
import { handleRadial } from './radial-handler'
import { unchanged, type CommandHandler, type Transition } from './ui-effects'
import { LayerKind, type UiState } from './ui-state'
import { handleWaiting } from './waiting-handler'

export type InputCommand = UiCommandOf<
  | typeof ToPage.Stick
  | typeof PageCommandType.LocalIntent
  | typeof PageCommandType.HoverItem
  | typeof PageCommandType.ClickItem
  | typeof PageCommandType.PointerAim
  | typeof PageCommandType.TypeText
>

function panelsHandler(state: UiState): CommandHandler<InputCommand> {
  const top = state.stack[state.stack.length - 1]
  const layer = top?.layers[top.layers.length - 1]
  if (layer?.kind === LayerKind.Keyboard) return handleKeyboardLayer
  if (layer?.kind === LayerKind.Confirm) return handleConfirmLayer
  return handleList
}

function inputHandler(state: UiState): CommandHandler<InputCommand> | null {
  if (state.paused) return null
  switch (state.mode) {
    case UiMode.Waiting:
      return handleWaiting
    case UiMode.Radial:
      return handleRadial
    case UiMode.Panels:
      return panelsHandler(state)
    default:
      return null
  }
}

export function routeInput(state: UiState, command: InputCommand, now: number): Transition {
  const handler = inputHandler(state)
  return handler === null ? unchanged(state) : handler(state, command, now)
}
