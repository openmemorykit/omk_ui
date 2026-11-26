import { CloseReason, ReplyKind, STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { FormStatus, setFieldValue } from '../../../src/page/domain/form'
import {
  closeAllFrames,
  closePanelFrame,
  dropOwnerFrames,
  FRAME_MAX_LAYERS,
  openPanelFrame,
  popTopFrame,
  pushPanelFrame,
  showConfirmLayer,
} from '../../../src/page/domain/navigation'
import { stackSnapshot } from '../../../src/page/domain/page-event'
import { ConfirmChoice, ConfirmOrigin, createInitialState, LayerKind } from '../../../src/page/domain/ui-state'
import { ENABLED_TOGGLE, PLAYER_LINK } from '../../fixtures/items'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM } from '../../fixtures/owned'
import { closedReplies, confirmFor, menuPanel, panelIdAt, replyKinds, stackIds, stackOfDepth } from './navigation-helpers'

const LIST_ID = OWNED_LIST_PANEL.panel.id
const ADD_ID = OWNED_ADD_PANEL.panel.id
const SEQ_OPEN = 1
const SEQ_PUSH = 2
const SEQ_NEXT = 3
const THIRD = 2

const listOpen = (): ReturnType<typeof createInitialState> => openPanelFrame(createInitialState(), OWNED_LIST_PANEL, SEQ_OPEN).state
const listAndAdd = (): ReturnType<typeof createInitialState> => pushPanelFrame(listOpen(), OWNED_ADD_PANEL, LIST_ID, SEQ_PUSH).state

describe('openPanelFrame', () => {
  it('opens one frame focused on the first focusable item', () => {
    const { state, replies } = openPanelFrame(createInitialState(), OWNED_LIST_PANEL, SEQ_OPEN)
    expect(state.stack).toEqual([{ panel: OWNED_LIST_PANEL, focusItemId: ENABLED_TOGGLE.id, layers: [], form: null, pendingItemId: null, visibleStart: 0 }])
    expect(state.appliedCommandSeq).toBe(SEQ_OPEN)
    expect(replies).toEqual([])
  })

  it('starts a form for a form panel', () => {
    const { state } = openPanelFrame(createInitialState(), OWNED_ADD_PANEL, SEQ_OPEN)
    expect(state.stack[0]?.form?.status).toBe(FormStatus.Editing)
    expect(state.stack[0]?.form?.values).toEqual({ identifier: '', role: 'member', notify: false })
  })

  it('replaces the stack and closes each replaced panel by its owner, top first', () => {
    const { state, replies } = openPanelFrame(listAndAdd(), menuPanel('other'), SEQ_NEXT)
    expect(stackIds(state)).toEqual(['whitelist/other'])
    expect(replies).toEqual([
      { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: ADD_ID, reason: CloseReason.ClosedByOwner } },
      { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: LIST_ID, reason: CloseReason.ClosedByOwner } },
    ])
  })
})

describe('pushPanelFrame', () => {
  it('stacks the panel above its parent and clears the parent pending link', () => {
    const withPending = { ...listOpen(), stack: listOpen().stack.map((frame) => ({ ...frame, pendingItemId: PLAYER_LINK.id })) }
    const { state, replies } = pushPanelFrame(withPending, OWNED_ADD_PANEL, LIST_ID, SEQ_PUSH)
    expect(stackIds(state)).toEqual([LIST_ID, ADD_ID])
    expect(state.stack[0]?.pendingItemId).toBeNull()
    expect(state.appliedCommandSeq).toBe(SEQ_PUSH)
    expect(replies).toEqual([])
  })

  it('discards a push whose parent is no longer on top and keeps the stack', () => {
    const before = listAndAdd()
    const { state, replies } = pushPanelFrame(before, menuPanel('details'), LIST_ID, SEQ_NEXT)
    expect(state.stack).toBe(before.stack)
    expect(state.appliedCommandSeq).toBe(SEQ_NEXT)
    expect(replies).toEqual([{ owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: 'whitelist/details', reason: CloseReason.Discarded } }])
  })

  it('discards a push of an identifier already in the stack', () => {
    const { state, replies } = pushPanelFrame(listAndAdd(), OWNED_LIST_PANEL, ADD_ID, SEQ_NEXT)
    expect(stackIds(state)).toEqual([LIST_ID, ADD_ID])
    expect(replies).toEqual([{ owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: LIST_ID, reason: CloseReason.Discarded } }])
  })

  it('refuses a ninth frame and tells its owner to drop its handlers', () => {
    const full = stackOfDepth(STACK_MAX_DEPTH)
    expect(full.stack).toHaveLength(STACK_MAX_DEPTH)
    const topId = panelIdAt(full, STACK_MAX_DEPTH - 1) ?? ''
    const { state, replies } = pushPanelFrame(full, menuPanel('ninth', FixtureOwner.Whitelist), topId, STACK_MAX_DEPTH + 1)
    expect(state.stack).toBe(full.stack)
    expect(replies).toEqual([{ owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: 'whitelist/ninth', reason: CloseReason.Discarded } }])
  })

  it('discards a push onto an empty confirmation frame', () => {
    const confirmOnly = showConfirmLayer(createInitialState(), OWNED_REMOVE_CONFIRM, SEQ_OPEN)
    const { state, replies } = pushPanelFrame(confirmOnly, OWNED_ADD_PANEL, LIST_ID, SEQ_PUSH)
    expect(state.stack).toBe(confirmOnly.stack)
    expect(replies).toEqual([{ owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: ADD_ID, reason: CloseReason.Discarded } }])
  })
})

describe('closePanelFrame', () => {
  it('ignores an unknown identifier but records the command number', () => {
    const before = listOpen()
    const { state, replies } = closePanelFrame(before, 'whitelist/unknown', SEQ_PUSH)
    expect(state.stack).toBe(before.stack)
    expect(state.appliedCommandSeq).toBe(SEQ_PUSH)
    expect(replies).toEqual([])
  })

  it('closes the top panel for its owner', () => {
    const { state, replies } = closePanelFrame(listAndAdd(), ADD_ID, SEQ_NEXT)
    expect(stackIds(state)).toEqual([LIST_ID])
    expect(replies).toEqual([{ owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: ADD_ID, reason: CloseReason.ClosedByOwner } }])
  })
})

describe('showConfirmLayer', () => {
  it('creates an empty frame for a confirmation without panel, absent from the snapshot', () => {
    const state = showConfirmLayer(createInitialState(), OWNED_REMOVE_CONFIRM, SEQ_OPEN)
    expect(state.stack).toHaveLength(1)
    expect(state.stack[0]?.panel).toBeNull()
    expect(state.stack[0]?.layers).toEqual([
      {
        kind: LayerKind.Confirm,
        origin: ConfirmOrigin.Request,
        content: { title: 'Remove Alex?', text: 'Alex will no longer join the server.', confirmLabel: 'Remove', danger: true },
        confirmId: OWNED_REMOVE_CONFIRM.confirm.id,
        itemId: null,
        choice: ConfirmChoice.Cancel,
      },
    ])
    expect(stackSnapshot(state)).toEqual({ appliedCommandSeq: SEQ_OPEN, entries: [] })
  })

  it('stacks the confirmation on the top frame of the same owner, Confirm chosen when not dangerous', () => {
    const safeConfirm = { ...OWNED_REMOVE_CONFIRM.confirm, danger: false }
    const state = showConfirmLayer(listOpen(), { owner: FixtureOwner.Whitelist, confirm: safeConfirm }, SEQ_PUSH)
    expect(state.stack).toHaveLength(1)
    expect(state.stack[0]?.layers[0]).toMatchObject({ choice: ConfirmChoice.Confirm, confirmId: OWNED_REMOVE_CONFIRM.confirm.id })
  })

  it('ignores a confirmation over another owner, a mismatched identifier and a duplicate', () => {
    const before = listOpen()
    expect(showConfirmLayer(before, confirmFor(FixtureOwner.Garage), SEQ_PUSH).stack).toBe(before.stack)
    expect(showConfirmLayer(before, { owner: FixtureOwner.Whitelist, confirm: confirmFor(FixtureOwner.Garage).confirm }, SEQ_PUSH).stack).toBe(before.stack)
    const shown = showConfirmLayer(before, OWNED_REMOVE_CONFIRM, SEQ_PUSH)
    expect(showConfirmLayer(shown, OWNED_REMOVE_CONFIRM, SEQ_NEXT).stack).toBe(shown.stack)
  })
})

describe('confirmation layers cap', () => {
  it('refuses a confirmation once the top frame holds FRAME_MAX_LAYERS layers', () => {
    const filled = Array.from({ length: FRAME_MAX_LAYERS }, (_, index) => index).reduce(
      (state, index) => showConfirmLayer(state, confirmFor(FixtureOwner.Whitelist, `confirm-${String(index)}`), SEQ_PUSH + index),
      listOpen(),
    )
    expect(filled.stack[0]?.layers).toHaveLength(FRAME_MAX_LAYERS)
    expect(showConfirmLayer(filled, confirmFor(FixtureOwner.Whitelist, 'one-more'), SEQ_NEXT + FRAME_MAX_LAYERS).stack).toBe(filled.stack)
  })
})

describe('popTopFrame and closeAllFrames', () => {
  it('pops the top frame with Back and leaves an empty stack untouched', () => {
    const { state, replies } = popTopFrame(listAndAdd())
    expect(stackIds(state)).toEqual([LIST_ID])
    expect(replies).toEqual([{ owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: ADD_ID, reason: CloseReason.Back } }])
    const empty = createInitialState()
    expect(popTopFrame(empty)).toEqual({ state: empty, replies: [] })
  })

  it('empties the stack with one reply per frame and no confirmation, even with a modified form', () => {
    const opened = listAndAdd()
    const form = opened.stack[1]?.form
    if (form === undefined || form === null) throw new Error('Expected a form')
    const modified = { ...opened, stack: opened.stack.map((frame, index) => (index === 1 ? { ...frame, form: setFieldValue(form, 'notify', true) } : frame)) }
    const { state, replies } = closeAllFrames(modified)
    expect(state.stack).toEqual([])
    expect(replyKinds(replies)).toEqual([ReplyKind.PanelClosed, ReplyKind.PanelClosed])
    expect(closedReplies(replies).map((reply) => [reply.panelId, reply.reason])).toEqual([[ADD_ID, CloseReason.CloseAll], [LIST_ID, CloseReason.CloseAll]])
    const empty = createInitialState()
    expect(closeAllFrames(empty)).toEqual({ state: empty, replies: [] })
  })
})

describe('dropOwnerFrames', () => {
  it('removes the frames of a stopped owner, its empty confirmation frame included', () => {
    expect(dropOwnerFrames(listAndAdd(), FixtureOwner.Whitelist, SEQ_NEXT).stack).toEqual([])
    const confirmOnly = showConfirmLayer(createInitialState(), OWNED_REMOVE_CONFIRM, SEQ_OPEN)
    expect(dropOwnerFrames(confirmOnly, FixtureOwner.Whitelist, SEQ_PUSH).stack).toEqual([])
  })

  it('keeps the frames of other owners and records the command number', () => {
    const before = listAndAdd()
    const state = dropOwnerFrames(before, FixtureOwner.Garage, SEQ_NEXT)
    expect(state.stack).toBe(before.stack)
    expect(state.appliedCommandSeq).toBe(SEQ_NEXT)
    expect(panelIdAt(state, THIRD)).toBeNull()
  })
})
