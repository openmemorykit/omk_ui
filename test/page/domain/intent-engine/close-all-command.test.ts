import { CloseReason, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { fallbackTransition } from '../../../../src/page/domain/command-fallback'
import { transition } from '../../../../src/page/domain/intent-engine'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../../src/protocol/to-page'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM } from '../../../fixtures/owned'
import { events, initial, NOW, withPanels } from './engine-helpers'

const PUSHED_SEQ = 2
const CONFIRM_SEQ = 3
const CLOSE_ALL_SEQ = 4

const listAndAddWithConfirm = transition(withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL]), { type: ToPage.ShowConfirm, commandSeq: CONFIRM_SEQ, confirm: OWNED_REMOVE_CONFIRM }, NOW).state

const closedAll = (panelId: string): unknown => ({ owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId, reason: CloseReason.CloseAll } })
const confirmRefused = { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.ConfirmAnswered, confirmId: OWNED_REMOVE_CONFIRM.confirm.id, confirmed: false } }
const everyFrameClosed = { stack: { appliedCommandSeq: CLOSE_ALL_SEQ, entries: [] }, replies: [confirmRefused, closedAll(OWNED_ADD_PANEL.panel.id), closedAll(OWNED_LIST_PANEL.panel.id)] }

describe('CloseAll', () => {
  it('closes every frame with CloseAll in one Event, answers the confirmation shown and goes back to Idle', () => {
    const next = transition(listAndAddWithConfirm, { type: ToPage.CloseAll, commandSeq: CLOSE_ALL_SEQ }, NOW)
    expect(next.state.stack).toEqual([])
    expect(next.state.mode).toBe(UiMode.Idle)
    expect(events(next.effects)).toEqual([everyFrameClosed])
  })

  it('sends one Event over an empty stack so the applied number moves on', () => {
    const next = transition(initial(), { type: ToPage.CloseAll, commandSeq: CLOSE_ALL_SEQ }, NOW)
    expect(events(next.effects)).toEqual([{ stack: { appliedCommandSeq: CLOSE_ALL_SEQ, entries: [] }, replies: [] }])
  })

  it('ignores a CloseAll the page has already applied', () => {
    const state = withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL])
    expect(transition(state, { type: ToPage.CloseAll, commandSeq: PUSHED_SEQ }, NOW)).toEqual({ state, effects: [] })
  })

  it('still closes every frame when its handler throws', () => {
    const next = fallbackTransition(listAndAddWithConfirm, { type: ToPage.CloseAll, commandSeq: CLOSE_ALL_SEQ })
    expect(next.state.stack).toEqual([])
    expect(events(next.effects)).toEqual([everyFrameClosed])
  })
})
