import { FromPage } from '../../protocol/from-page'
import { sendToHost, type Transition } from './ui-effects'
import { LayerKind, type Layer, type UiState } from './ui-state'

const isKeyboard = (layer: Layer): boolean => layer.kind === LayerKind.Keyboard

export function isTextEntryActive(state: UiState): boolean {
  const top = state.stack[state.stack.length - 1]
  return !state.paused && top !== undefined && top.layers.some(isKeyboard)
}

export function settleTextEntry(before: UiState, next: Transition): Transition {
  if (!isTextEntryActive(before) || isTextEntryActive(next.state)) return next
  return { state: next.state, effects: next.effects.concat(sendToHost({ type: FromPage.TextEntry, active: false })) }
}
