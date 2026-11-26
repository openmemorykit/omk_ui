import { describe, expect, it } from 'vitest'
import { handleConfirmLayer } from '../../../../src/page/domain/confirm-handler'
import { expireForms, submitTopForm } from '../../../../src/page/domain/form-handler'
import { closeKeyboardLayer, handleKeyboardLayer, openKeyboardLayer } from '../../../../src/page/domain/keyboard-handler'
import { handleList } from '../../../../src/page/domain/list-handler'
import { FRAME_MAX_LAYERS } from '../../../../src/page/domain/navigation'
import { TimerKind } from '../../../../src/page/domain/page-commands'
import { ConfirmChoice, ConfirmOrigin, LayerKind, type ConfirmLayer, type Frame, type Layer, type UiState } from '../../../../src/page/domain/ui-state'
import { Intent } from '../../../../src/protocol/intents'
import { IDENTIFIER_TEXT } from '../../../fixtures/items'
import { OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM } from '../../../fixtures/owned'
import { initial, NOW, press, release, run, timerFired, withPanels } from './engine-helpers'
import { hover, NOTE_MENU, topFrame, topLayer } from './handler-helpers'

const GHOST_ID = 'ghost'
const PENDING_ROW = 'player-1'
const UNKNOWN_LANGUAGE = 'zz'
const NOT_A_TIME = Number.NaN
const REQUEST_CONFIRM: ConfirmLayer = { kind: LayerKind.Confirm, origin: ConfirmOrigin.Request, content: OWNED_REMOVE_CONFIRM.confirm, confirmId: null, itemId: null, choice: ConfirmChoice.Confirm }

function withTopLayers(state: UiState, layers: readonly Layer[]): UiState {
  const frame: Frame = { ...topFrame(state), layers }
  return { ...state, stack: state.stack.slice(0, -1).concat(frame) }
}

function unchangedBy(handler: (state: UiState) => { readonly state: UiState; readonly effects: readonly unknown[] }, state: UiState): void {
  expect(handler(state)).toEqual({ state, effects: [] })
}

describe('list handler: edges', () => {
  it('ignores the release of an intent and timers it does not own', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    unchangedBy((current) => handleList(current, release(Intent.Confirm), NOW), state)
    unchangedBy((current) => handleList(current, timerFired(TimerKind.Repeat), NOW), state)
  })

  it('clears a pending link only on the frames that have one', () => {
    const base = withPanels([OWNED_LIST_PANEL, NOTE_MENU])
    const [first, second] = base.stack
    const pending: UiState = { ...base, stack: [{ ...first!, pendingItemId: PENDING_ROW }, second!] }
    const cleared = handleList(pending, timerFired(TimerKind.LinkPending), NOW).state
    expect(cleared.stack[0]?.pendingItemId).toBeNull()
    expect(cleared.stack[1]).toBe(second)
  })
})

describe('form handler: edges', () => {
  it('does nothing without a form to submit', () => {
    unchangedBy((current) => submitTopForm(current, NOW), initial())
    unchangedBy((current) => submitTopForm(current, NOW), withPanels([OWNED_LIST_PANEL]))
  })

  it('schedules no deadline when the clock is not a number', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    expect(expireForms(state, NOT_A_TIME)).toEqual({ state, effects: [] })
  })
})

describe('confirmation layer: edges', () => {
  const asked = withTopLayers(withPanels([OWNED_LIST_PANEL]), [REQUEST_CONFIRM])

  it('answers nothing for a request that has no confirmation id', () => {
    const next = handleConfirmLayer(asked, press(Intent.Confirm), NOW)
    expect(next.effects).toEqual([])
    expect(topLayer(next.state)).toBeUndefined()
  })

  it('does nothing for a layer of an unknown origin', () => {
    const forged = withTopLayers(asked, [{ ...REQUEST_CONFIRM, origin: GHOST_ID as ConfirmOrigin }])
    unchangedBy((current) => handleConfirmLayer(current, press(Intent.Confirm), NOW), forged)
  })

  it('keeps the state when the hovered choice is already the current one', () => {
    unchangedBy((current) => handleConfirmLayer(current, hover(ConfirmChoice.Confirm), NOW), asked)
  })

  it('ignores the release of an intent', () => {
    unchangedBy((current) => handleConfirmLayer(current, release(Intent.Confirm), NOW), asked)
  })
})

describe('keyboard layer: edges', () => {
  const typing = run(withPanels([NOTE_MENU]), [press(Intent.Confirm)]).state

  it('does nothing when there is no frame', () => {
    unchangedBy((current) => closeKeyboardLayer(current, null), initial())
    unchangedBy((current) => handleKeyboardLayer(current, press(Intent.Confirm), NOW), initial())
  })

  it('ignores the release of an intent', () => {
    unchangedBy((current) => handleKeyboardLayer(current, release(Intent.Confirm), NOW), typing)
  })

  it('closes a layer whose text row has disappeared without sending anything', () => {
    const layer = topLayer(typing)
    const orphan = withTopLayers(typing, [{ ...layer!, itemId: GHOST_ID }])
    const next = closeKeyboardLayer(orphan, 'kept')
    expect(next.effects).toEqual([])
    expect(topFrame(next.state).layers).toEqual([])
  })

  it('keeps the state when erasing an empty text', () => {
    unchangedBy((current) => handleKeyboardLayer(current, press(Intent.Erase), NOW), typing)
  })

  it('keeps the other layers when the keyboard changes under them', () => {
    const layered = withTopLayers(typing, [REQUEST_CONFIRM, topLayer(typing)!])
    const next = handleKeyboardLayer(layered, press(Intent.Right), NOW)
    expect(topFrame(next.state).layers[0]).toBe(REQUEST_CONFIRM)
  })

  it('opens the English keyboard for an unknown language', () => {
    const state = { ...withPanels([NOTE_MENU]), language: UNKNOWN_LANGUAGE }
    const frame = topFrame(state)
    const opened = openKeyboardLayer(state, frame, { ...IDENTIFIER_TEXT, id: 'note' })
    expect(topLayer(opened.state)?.kind).toBe(LayerKind.Keyboard)
  })

  it('does not open a keyboard when the frame has no room for a layer', () => {
    const crowded = withTopLayers(typing, Array.from({ length: FRAME_MAX_LAYERS }, () => REQUEST_CONFIRM))
    unchangedBy((current) => openKeyboardLayer(current, topFrame(current), { ...IDENTIFIER_TEXT, id: 'note' }), crowded)
  })
})
