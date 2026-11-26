import { CloseReason, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { closePanelFrame, openPanelFrame, pushPanelFrame } from '../../../src/page/domain/navigation'
import { pageEvent, stackSnapshot } from '../../../src/page/domain/page-event'
import { createInitialState } from '../../../src/page/domain/ui-state'
import { FromPage, type FromPageMessage, type FromPageMessageOf } from '../../../src/protocol/from-page'
import { fromPageStackSnapshot, type OwnedReply } from '../../../src/protocol/stack'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_LIST_PANEL } from '../../fixtures/owned'
import { OWNED_REPLIES, PAGE_REPLIES } from '../../fixtures/replies'
import { SHARED_STACK_OWNED, SHARED_STACK_SEQ, SHARED_STACK_SNAPSHOT } from '../../fixtures/stack'

const LONG_REPLY_COUNT = 50_000
const LONG_REPLY_BUDGET_MS = 250

type EventMessage = FromPageMessageOf<typeof FromPage.Event>

function asEvent(message: FromPageMessage): EventMessage {
  if (message.type !== FromPage.Event) throw new Error('Expected an Event message')
  return message
}

const LIST_ID = OWNED_LIST_PANEL.panel.id
const ADD_ID = OWNED_ADD_PANEL.panel.id
const whitelist = (reply: OwnedReply['reply']): OwnedReply => ({ owner: FixtureOwner.Whitelist, reply })
const closed = (panelId: string, reason: CloseReason): OwnedReply => whitelist({ kind: ReplyKind.PanelClosed, panelId, reason })
const selected = (panelId: string): OwnedReply => whitelist({ kind: ReplyKind.ItemSelected, panelId, itemId: 'player-1' })

function sharedStackState(): ReturnType<typeof createInitialState> {
  const [list, add] = SHARED_STACK_OWNED
  const opened = openPanelFrame(createInitialState(), list, SHARED_STACK_SEQ.Open).state
  return pushPanelFrame(opened, add, list.panel.id, SHARED_STACK_SEQ.Push).state
}

describe('stackSnapshot', () => {
  it('produces the shared stack fixture that the client registry reconciles', () => {
    expect(stackSnapshot(sharedStackState())).toEqual(SHARED_STACK_SNAPSHOT)
  })

  it('lists entries from bottom to top with the last applied command number', () => {
    const later = closePanelFrame(sharedStackState(), 'whitelist/unknown', SHARED_STACK_SEQ.Push + 1).state
    const snapshot = stackSnapshot(later)
    expect(snapshot.entries.map((entry) => entry.panelId)).toEqual([LIST_ID, ADD_ID])
    expect(snapshot.appliedCommandSeq).toBe(SHARED_STACK_SEQ.Push + 1)
  })

  it('reads back through fromPageStackSnapshot', () => {
    expect(fromPageStackSnapshot(stackSnapshot(sharedStackState()))).not.toBeNull()
    expect(fromPageStackSnapshot(stackSnapshot(createInitialState()))).toEqual({ appliedCommandSeq: 0, entries: [] })
  })
})

describe('pageEvent', () => {
  it('builds a single Event message carrying the stack and the replies together', () => {
    const snapshot = stackSnapshot(sharedStackState())
    const message = asEvent(pageEvent(snapshot, OWNED_REPLIES))
    expect(message).toEqual({ type: FromPage.Event, event: { stack: snapshot, replies: OWNED_REPLIES } })
  })

  it('keeps a null stack when only replies change', () => {
    const replies = [whitelist(PAGE_REPLIES[ReplyKind.ItemSelected])]
    expect(asEvent(pageEvent(null, replies)).event).toEqual({ stack: null, replies })
  })

  it('drops every reply for an instance once its PanelClosed is in the event', () => {
    const replies = [selected(LIST_ID), closed(LIST_ID, CloseReason.Back), selected(LIST_ID), closed(LIST_ID, CloseReason.CloseAll)]
    expect(asEvent(pageEvent(null, replies)).event.replies).toEqual([selected(LIST_ID), closed(LIST_ID, CloseReason.Back)])
  })

  it('keeps a single ConfirmAnswered per confirmation', () => {
    const answer = whitelist(PAGE_REPLIES[ReplyKind.ConfirmAnswered])
    const refusal = whitelist({ ...PAGE_REPLIES[ReplyKind.ConfirmAnswered], confirmed: false })
    expect(asEvent(pageEvent(null, [refusal, answer, refusal])).event.replies).toEqual([refusal])
  })

  it('filters a long reply list in linear time and freezes it', () => {
    const replies = Array.from({ length: LONG_REPLY_COUNT }, (_, index) => closed(`whitelist/panel-${String(index)}`, CloseReason.CloseAll))
    pageEvent(null, replies)
    const startedAt = Date.now()
    const kept = asEvent(pageEvent(null, replies)).event.replies
    expect(Date.now() - startedAt).toBeLessThan(LONG_REPLY_BUDGET_MS)
    expect(kept).toEqual(replies)
    expect(Object.isFrozen(kept)).toBe(true)
  })

  it('keeps replies of other instances after a PanelClosed', () => {
    const replies = [closed(ADD_ID, CloseReason.Back), selected(LIST_ID), whitelist(PAGE_REPLIES[ReplyKind.ConfirmAnswered])]
    expect(asEvent(pageEvent(null, replies)).event.replies).toEqual(replies)
  })
})
