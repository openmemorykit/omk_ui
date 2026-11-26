import { FromPage, type FromPageMessage } from '../../protocol/from-page'
import { UiMode } from '../../protocol/page-vocabulary'
import { TimerKind } from './page-commands'
import { cancelSchedule, sendToHost, type Transition, type UiEffect } from './ui-effects'
import type { UiState } from './ui-state'

const ESCAPE_HELD: { readonly escapeHeld: true } = Object.freeze({ escapeHeld: true })

export function derivedMode(state: UiState): UiMode {
  const hasFrames = state.stack.length > 0
  if (state.mode === UiMode.Panels && !hasFrames) return UiMode.Idle
  if ((state.mode === UiMode.Idle || state.mode === UiMode.Waiting) && hasFrames) return UiMode.Panels
  return state.mode
}

export function modeChanged(mode: UiMode, escapeHeld: boolean): FromPageMessage {
  return { type: FromPage.ModeChanged, mode, ...(escapeHeld ? ESCAPE_HELD : {}) }
}

function settledState(state: UiState, mode: UiMode): UiState {
  const escapeHeld = mode === UiMode.Idle && state.escapeHeld
  return mode === state.mode && escapeHeld === state.escapeHeld ? state : { ...state, mode, escapeHeld }
}

export function settleMode(before: UiState, next: Transition, endsWaitingItself: boolean): Transition {
  const state = settledState(next.state, derivedMode(next.state))
  if (state.mode === before.mode) return state === next.state ? next : { state, effects: next.effects }
  const waitingEnded: readonly UiEffect[] = before.mode === UiMode.Waiting && !endsWaitingItself ? [cancelSchedule(TimerKind.WaitingTimeout)] : []
  return { state, effects: next.effects.concat(waitingEnded, sendToHost(modeChanged(state.mode, state.escapeHeld))) }
}
