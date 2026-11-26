import { FromPage } from '../../protocol/from-page'
import { sendToHost, UiEffectType, type Transition, type UiEffect } from './ui-effects'
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

export function textEntryResumed(state: UiState): readonly UiEffect[] {
  const top = state.stack[state.stack.length - 1]
  const layer = top?.layers.find(isKeyboard)
  if (state.paused || layer?.kind !== LayerKind.Keyboard) return []
  return [sendToHost({ type: FromPage.TextEntry, active: true }), { type: UiEffectType.FocusTextInput, itemId: layer.itemId }]
}
