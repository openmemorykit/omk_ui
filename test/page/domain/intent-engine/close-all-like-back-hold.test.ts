import { CloseReason } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { BACK_HOLD_MS } from '../../../../src/page/domain/hold-detector'
import { transition } from '../../../../src/page/domain/intent-engine'
import { TimerKind } from '../../../../src/page/domain/page-commands'
import type { Transition } from '../../../../src/page/domain/ui-effects'
import type { UiState } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { Intent } from '../../../../src/protocol/intents'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../../src/protocol/to-page'
import { OWNED_ADD_PANEL, OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM, OWNED_WHITELIST_RADIAL_ENTRY } from '../../../fixtures/owned'
import { events, NOW, OPEN_RADIAL, press, radialEntries, release, run, sentOf, timerFired, withPanels } from './engine-helpers'

const CONFIRM_SEQ = 3
const CLOSE_ALL_SEQ = 4

const withConfirm = (state: UiState): UiState => transition(state, { type: ToPage.ShowConfirm, commandSeq: CONFIRM_SEQ, confirm: OWNED_REMOVE_CONFIRM }, NOW).state

const afterFirstBack = (state: UiState): UiState => transition(state, press(Intent.Back), NOW).state
const closedByBackHold = (state: UiState): Transition => transition(state, timerFired(TimerKind.BackHold), NOW + BACK_HOLD_MS)
const closedByCommand = (state: UiState): Transition => transition(state, { type: ToPage.CloseAll, commandSeq: CLOSE_ALL_SEQ }, NOW)

function underRadialChildren(): UiState {
  return run(withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL]), [radialEntries([OWNED_WHITELIST_RADIAL_ENTRY]), OPEN_RADIAL, press(Intent.Up)]).state
}

describe('ToPage.CloseAll is what the held back does after its first press, sent by the client', () => {
  const states: readonly (readonly [string, () => UiState])[] = [
    ['three panels', () => withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL, OWNED_LIST_PANEL])],
    ['two panels and a confirmation', () => withConfirm(withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL]))],
    ['two panels under the radial', underRadialChildren],
  ]

  it.each(states)('leaves the same stack, mode and replies as the hold over %s', (_, start) => {
    const pressed = afterFirstBack(start())
    const byHold = closedByBackHold(pressed)
    const byCommand = closedByCommand(pressed)
    expect(byCommand.state.stack).toEqual(byHold.state.stack)
    expect(byCommand.state.mode).toBe(byHold.state.mode)
    expect(byCommand.state.mode).toBe(UiMode.Idle)
    expect(events(byCommand.effects).map((event) => event.replies)).toEqual(events(byHold.effects).map((event) => event.replies))
    expect(sentOf(byCommand.effects, FromPage.ModeChanged)).toEqual(sentOf(byHold.effects, FromPage.ModeChanged))
  })

  it('answers every frame with the CloseAll reason', () => {
    const next = closedByCommand(withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL]))
    const reasons = events(next.effects).flatMap((event) => event.replies.map((reply) => reply.reply)).flatMap((reply) => ('reason' in reply ? [reply.reason] : []))
    expect(reasons).toEqual([CloseReason.CloseAll, CloseReason.CloseAll])
  })
})

describe('B held, then Escape, then B released first (n2 of the first milestone)', () => {
  it('closes nothing: the hold belongs to the first source pressed and ends when it is released', () => {
    const start = withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL])
    const step = run(start, [press(Intent.Back), press(Intent.Back, true), release(Intent.Back)])
    const late = transition(step.state, timerFired(TimerKind.BackHold), NOW + BACK_HOLD_MS)
    expect(late.state.stack).toHaveLength(step.state.stack.length)
    expect(events(late.effects).flatMap((event) => event.replies)).toEqual([])
  })

  it('does not close all either when Escape itself is released afterwards', () => {
    const start = withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL])
    const step = run(start, [press(Intent.Back), press(Intent.Back, true), release(Intent.Back), release(Intent.Back, true)])
    const late = transition(step.state, timerFired(TimerKind.BackHold), NOW + BACK_HOLD_MS)
    expect(late.state.stack).toHaveLength(step.state.stack.length)
  })
})
