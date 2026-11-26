import type { OwnedReply } from '../../protocol/stack'
import { FRAME_MAX_LAYERS } from './navigation'
import { pageEvent } from './page-event'
import { sendToHost, type UiEffect } from './ui-effects'
import type { Frame, Layer, UiState } from './ui-state'

const LAST = -1

export function topFrameOf(state: UiState): Frame | undefined {
  return state.stack[state.stack.length + LAST]
}

export function topLayerOf(frame: Frame): Layer | undefined {
  return frame.layers[frame.layers.length + LAST]
}

export function withTopFrame(state: UiState, frame: Frame): UiState {
  const top = topFrameOf(state)
  return top === undefined || top === frame ? state : { ...state, stack: state.stack.slice(0, LAST).concat(frame) }
}

export function withLayer(frame: Frame, layer: Layer): Frame {
  return frame.layers.length >= FRAME_MAX_LAYERS ? frame : { ...frame, layers: frame.layers.concat(layer) }
}

export function withoutTopLayer(frame: Frame): Frame {
  return { ...frame, layers: frame.layers.slice(0, LAST) }
}

export function replyEvent(replies: readonly OwnedReply[]): UiEffect {
  return sendToHost(pageEvent(null, replies))
}
