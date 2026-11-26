import { ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { transition } from '../../../../src/page/domain/intent-engine'
import { handleConfirmLayer } from '../../../../src/page/domain/panel-handlers'
import { modeChanged } from '../../../../src/page/domain/mode-change'
import { sendToHost, UiEffectType } from '../../../../src/page/domain/ui-effects'
import { ConfirmChoice, LayerKind, type UiState } from '../../../../src/page/domain/ui-state'
import { Intent } from '../../../../src/protocol/intents'
import type { OwnedConfirm } from '../../../../src/protocol/owned'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../../src/protocol/to-page'
import { REMOVE_ALL_ACTION } from '../../../fixtures/items'
import { FixtureOwner, OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM } from '../../../fixtures/owned'
import { initial, NOW, press, run, withPanels } from './engine-helpers'
import { BACK_HOLD_SCHEDULE, click, GAMEPAD, hover, NOTE_MENU, REPEAT_SCHEDULE, replyEvent, topFrame, topLayer } from './handler-helpers'

const OWNER = FixtureOwner.Whitelist
const CONFIRM_ID = OWNED_REMOVE_CONFIRM.confirm.id
const SAFE_CONFIRM: OwnedConfirm = { owner: OWNER, confirm: { ...OWNED_REMOVE_CONFIRM.confirm, danger: false } }
const NEXT_SEQ = 2

function shown(base: UiState, confirm: OwnedConfirm = OWNED_REMOVE_CONFIRM): UiState {
  return run(base, [{ type: ToPage.ShowConfirm, commandSeq: base.appliedCommandSeq + 1, confirm }]).state
}

function answered(confirmed: boolean): ReturnType<typeof replyEvent> {
  return replyEvent(OWNER, { kind: ReplyKind.ConfirmAnswered, confirmId: CONFIRM_ID, confirmed })
}

function choiceOf(state: UiState): string | null {
  const layer = topLayer(state)
  return layer?.kind === LayerKind.Confirm ? layer.choice : null
}

describe('confirmation layer: choice', () => {
  it('starts on Cancel for a danger confirmation and on Confirm otherwise', () => {
    expect(choiceOf(shown(withPanels([OWNED_LIST_PANEL])))).toBe(ConfirmChoice.Cancel)
    expect(choiceOf(shown(withPanels([OWNED_LIST_PANEL]), SAFE_CONFIRM))).toBe(ConfirmChoice.Confirm)
  })

  it('alternates on up and down', () => {
    const state = shown(withPanels([OWNED_LIST_PANEL]))
    const raised = transition(state, press(Intent.Up), NOW)
    expect(choiceOf(raised.state)).toBe(ConfirmChoice.Confirm)
    expect(raised.effects).toEqual([REPEAT_SCHEDULE])
    expect(choiceOf(run(raised.state, [press(Intent.Down)]).state)).toBe(ConfirmChoice.Cancel)
  })

  it('takes the hovered choice with keyboard and mouse only', () => {
    const state = shown(withPanels([OWNED_LIST_PANEL]))
    expect(choiceOf(transition(state, hover(ConfirmChoice.Confirm), NOW).state)).toBe(ConfirmChoice.Confirm)
    const pad = run(state, [GAMEPAD]).state
    expect(transition(pad, hover(ConfirmChoice.Confirm), NOW).state).toBe(pad)
    expect(transition(state, hover('toString'), NOW).state).toBe(state)
  })

  it('ignores left, right, tabs and text', () => {
    const state = shown(withPanels([OWNED_LIST_PANEL]))
    ;[Intent.Left, Intent.Right, Intent.TabNext, Intent.Erase].forEach((intent) => {
      expect(handleConfirmLayer(state, press(intent), NOW)).toEqual({ state, effects: [] })
    })
  })
})

describe('confirmation layer: answers of a request', () => {
  it('answers yes on confirm with the confirm choice and removes the layer', () => {
    const state = run(shown(withPanels([OWNED_LIST_PANEL]), SAFE_CONFIRM), []).state
    const next = transition(state, press(Intent.Confirm), NOW)
    expect(next.effects).toEqual([answered(true)])
    expect(topFrame(next.state).layers).toEqual([])
    expect(next.state.mode).toBe(UiMode.Panels)
  })

  it('answers no on confirm with the cancel choice', () => {
    const next = transition(shown(withPanels([OWNED_LIST_PANEL])), press(Intent.Confirm), NOW)
    expect(next.effects).toEqual([answered(false)])
  })

  it('answers no on back, once, and the next back goes to the list', () => {
    const state = shown(withPanels([OWNED_LIST_PANEL]), SAFE_CONFIRM)
    const next = transition(state, press(Intent.Back), NOW)
    expect(next.effects).toEqual([BACK_HOLD_SCHEDULE, answered(false)])
    expect(topFrame(next.state).layers).toEqual([])
  })

  it('answers the clicked choice', () => {
    const next = transition(shown(withPanels([OWNED_LIST_PANEL])), click(ConfirmChoice.Confirm), NOW)
    expect(next.effects).toEqual([answered(true)])
  })

  it('closes its empty frame and goes back to Idle when no panel is open', () => {
    const state = shown(initial(), SAFE_CONFIRM)
    expect(state.mode).toBe(UiMode.Panels)
    const next = transition(state, press(Intent.Confirm), NOW)
    expect(next.state.stack).toEqual([])
    expect(next.state.mode).toBe(UiMode.Idle)
    expect(next.effects).toEqual([answered(true), sendToHost(modeChanged(UiMode.Idle, false))])
  })

  it('waits for the end of Escape when back by Escape closes the empty frame', () => {
    const next = transition(shown(initial()), press(Intent.Back, true), NOW)
    expect(next.effects).toEqual([answered(false), sendToHost(modeChanged(UiMode.Idle, true))])
  })

  it('focuses the text input again when the answer uncovers the keyboard, keeping the text entry on', () => {
    const typing = run(withPanels([NOTE_MENU]), [press(Intent.Confirm)]).state
    const next = transition(shown(typing, SAFE_CONFIRM), press(Intent.Confirm), NOW)
    expect(next.effects).toEqual([answered(true), { type: UiEffectType.FocusTextInput, itemId: 'note' }])
    expect(topLayer(next.state)?.kind).toBe(LayerKind.Keyboard)
  })

  it('keeps the frame of the request when a panel is open', () => {
    const state = shown(withPanels([OWNED_LIST_PANEL]))
    expect(run(state, [press(Intent.Confirm)]).state.stack.map((frame) => frame.panel?.panel.id)).toEqual([OWNED_LIST_PANEL.panel.id])
  })

  it('answers exactly once, the next confirm going to the list', () => {
    const effects = run(shown(withPanels([OWNED_LIST_PANEL]), SAFE_CONFIRM), [press(Intent.Confirm), press(Intent.Confirm)]).effects
    const answers = effects.filter((effect) => JSON.stringify(effect).includes(ReplyKind.ConfirmAnswered))
    expect(answers).toEqual([answered(true)])
  })
})

describe('confirmation layer: answers of an action', () => {
  const onRemoveAll = (): UiState => run(withPanels([OWNED_LIST_PANEL]), [hover('remove-all'), press(Intent.Confirm)]).state

  it('sends ItemSelected on yes', () => {
    const state = run(onRemoveAll(), [press(Intent.Up)]).state
    const next = transition(state, press(Intent.Confirm), NOW)
    expect(next.effects).toEqual([replyEvent(OWNER, { kind: ReplyKind.ItemSelected, panelId: OWNED_LIST_PANEL.panel.id, itemId: 'remove-all' })])
    expect(topFrame(next.state).layers).toEqual([])
  })

  it('sends nothing on no or on back', () => {
    const declined = transition(onRemoveAll(), press(Intent.Confirm), NOW)
    expect(declined.effects).toEqual([])
    expect(topFrame(declined.state).layers).toEqual([])
    expect(transition(onRemoveAll(), press(Intent.Back), NOW).effects).toEqual([BACK_HOLD_SCHEDULE])
  })

  it('sends nothing on yes when the action became disabled in the meantime', () => {
    const state = run(onRemoveAll(), [press(Intent.Up)]).state
    const items = OWNED_LIST_PANEL.panel.items.map((item) => (item.id === REMOVE_ALL_ACTION.id ? { ...item, disabled: { reason: 'Busy' } } : item))
    const updated = run(state, [{ type: ToPage.UpdatePanel, panel: { ...OWNED_LIST_PANEL, panel: { ...OWNED_LIST_PANEL.panel, items } } }]).state
    expect(transition(updated, press(Intent.Confirm), NOW).effects).toEqual([])
  })
})

describe('confirmation layer: guards', () => {
  it('does nothing without a confirmation layer on top', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    expect(handleConfirmLayer(state, press(Intent.Confirm), NOW)).toEqual({ state, effects: [] })
    expect(handleConfirmLayer(initial(), press(Intent.Confirm), NOW)).toEqual({ state: initial(), effects: [] })
  })

  it('keeps the request numbering untouched', () => {
    const state = shown(withPanels([OWNED_LIST_PANEL]))
    expect(run(state, [press(Intent.Confirm)]).state.appliedCommandSeq).toBe(NEXT_SEQ)
  })
})
