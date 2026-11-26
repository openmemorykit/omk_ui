import { describe, expect, it } from 'vitest'
import { FormStatus, setFieldValue } from '../../../src/page/domain/form'
import { openPanelFrame, showConfirmLayer, updatePanelFrame } from '../../../src/page/domain/navigation'
import { ConfirmChoice, ConfirmOrigin, createInitialState, LayerKind, type Layer } from '../../../src/page/domain/ui-state'
import { ADD_ACTION, ENABLED_TOGGLE, PLAYER_LINK, PLAYERS_SECTION, PURGE_ACTION } from '../../fixtures/items'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM } from '../../fixtures/owned'
import { menuPanel } from './navigation-helpers'

const LIST_ID = OWNED_LIST_PANEL.panel.id
const SEQ_OPEN = 1
const SEQ_PUSH = 2

const listOpen = (): ReturnType<typeof createInitialState> => openPanelFrame(createInitialState(), OWNED_LIST_PANEL, SEQ_OPEN).state

describe('updatePanelFrame', () => {
  const withFocus = (itemId: string): ReturnType<typeof createInitialState> => {
    const state = listOpen()
    return { ...state, stack: state.stack.map((frame) => ({ ...frame, focusItemId: itemId })) }
  }

  it('keeps the focus on the same item identifier when items move', () => {
    const moved = menuPanel('list', FixtureOwner.Whitelist, [PLAYER_LINK, ENABLED_TOGGLE, ADD_ACTION])
    const state = updatePanelFrame(withFocus(ADD_ACTION.id), moved)
    expect(state.stack[0]?.focusItemId).toBe(ADD_ACTION.id)
    expect(state.stack[0]?.panel).toBe(moved)
  })

  it('moves the focus to the nearest survivor when the focused item disappears', () => {
    const shrunk = menuPanel('list', FixtureOwner.Whitelist, [ENABLED_TOGGLE, PLAYERS_SECTION, PURGE_ACTION])
    expect(updatePanelFrame(withFocus(PLAYER_LINK.id), shrunk).stack[0]?.focusItemId).toBe(PURGE_ACTION.id)
  })

  it('ignores an unknown panel and a panel of another owner', () => {
    const before = listOpen()
    expect(updatePanelFrame(before, menuPanel('unknown'))).toBe(before)
    expect(updatePanelFrame(before, { ...OWNED_LIST_PANEL, owner: FixtureOwner.Garage })).toBe(before)
  })

  it('drops layers and pending links tied to removed items but keeps a requested confirmation', () => {
    const requested = showConfirmLayer(listOpen(), OWNED_REMOVE_CONFIRM, SEQ_PUSH)
    const frame = requested.stack[0]
    if (frame === undefined) throw new Error('Expected a frame')
    const itemConfirm: Layer = {
      kind: LayerKind.Confirm,
      origin: ConfirmOrigin.Item,
      content: OWNED_REMOVE_CONFIRM.confirm,
      confirmId: null,
      itemId: PLAYER_LINK.id,
      choice: ConfirmChoice.Cancel,
    }
    const decorated = { ...requested, stack: [{ ...frame, layers: [itemConfirm, ...frame.layers], pendingItemId: PLAYER_LINK.id }] }
    const updated = updatePanelFrame(decorated, menuPanel('list', FixtureOwner.Whitelist, [ENABLED_TOGGLE]))
    expect(updated.stack[0]?.layers).toEqual(frame.layers)
    expect(updated.stack[0]?.pendingItemId).toBeNull()
  })

  it('clears the pending link even when its item is still in the updated panel', () => {
    const opened = listOpen()
    const pending = { ...opened, stack: opened.stack.map((frame) => ({ ...frame, pendingItemId: PLAYER_LINK.id })) }
    expect(updatePanelFrame(pending, OWNED_LIST_PANEL).stack[0]?.pendingItemId).toBeNull()
  })

  it('merges the form values of an updated form', () => {
    const opened = openPanelFrame(createInitialState(), OWNED_ADD_PANEL, SEQ_OPEN).state
    const form = opened.stack[0]?.form
    if (form === undefined || form === null) throw new Error('Expected a form')
    const edited = { ...opened, stack: opened.stack.map((frame) => ({ ...frame, form: setFieldValue(form, 'notify', true) })) }
    expect(updatePanelFrame(edited, OWNED_ADD_PANEL).stack[0]?.form?.values).toEqual({ identifier: '', role: 'member', notify: true })
  })

  it('starts or ends the form when the panel kind changes', () => {
    const asForm = { ...OWNED_ADD_PANEL, panel: { ...OWNED_ADD_PANEL.panel, id: LIST_ID } }
    const becameForm = updatePanelFrame(listOpen(), asForm)
    expect(becameForm.stack[0]?.form?.status).toBe(FormStatus.Editing)
    expect(updatePanelFrame(becameForm, OWNED_LIST_PANEL).stack[0]?.form).toBeNull()
  })
})
