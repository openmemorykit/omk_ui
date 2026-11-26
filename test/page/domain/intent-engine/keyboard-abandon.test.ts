import { describe, expect, it } from 'vitest'
import { transition } from '../../../../src/page/domain/intent-engine'
import { ABANDON_TEXT_CONTENT } from '../../../../src/page/domain/keyboard-handler'
import { PageCommandType, type UiCommand } from '../../../../src/page/domain/page-commands'
import { sendToHost, UiEffectType } from '../../../../src/page/domain/ui-effects'
import { LayerKind, type UiState } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { Intent } from '../../../../src/protocol/intents'
import { ToPage } from '../../../../src/protocol/to-page'
import { NOTIFY_TOGGLE } from '../../../fixtures/items'
import { FixtureOwner } from '../../../fixtures/owned'
import { menuPanel } from '../navigation-helpers'
import { NOW, press, run, withPanels } from './engine-helpers'
import { NOTE_MENU, PLAIN_TEXT, TEXT_ENTRY_OFF, TEXT_ENTRY_ON, topFrame, typeText } from './handler-helpers'

const FOCUS_NOTE = { type: UiEffectType.FocusTextInput, itemId: 'note' } as const
const NOT_A_FIELD = { ...NOTIFY_TOGGLE, id: PLAIN_TEXT.id }
const WITHOUT_TEXT_FIELD = menuPanel('notes', FixtureOwner.Whitelist, [NOT_A_FIELD])
const PAUSED = (paused: boolean): UiCommand => ({ type: paused ? PageCommandType.WindowBlurred : PageCommandType.WindowFocused })

function asking(): UiState {
  return run(withPanels([NOTE_MENU]), [press(Intent.Confirm), typeText('draft'), press(Intent.Back)]).state
}

function withoutKeyboard(): UiState {
  const updated = run(asking(), [{ type: ToPage.UpdatePanel, panel: WITHOUT_TEXT_FIELD }]).state
  expect(topFrame(updated).layers.map((layer) => layer.kind)).toEqual([LayerKind.Confirm])
  return updated
}

describe('abandon text confirmation: keys', () => {
  it('uses translation keys prefixed by ui.', () => {
    expect(ABANDON_TEXT_CONTENT).toMatchObject({
      title: 'ui.abandonText.title',
      text: 'ui.abandonText.text',
      confirmLabel: 'ui.abandonText.confirm',
      cancelLabel: 'ui.abandonText.cancel',
    })
  })
})

describe('abandon text confirmation without keyboard layer', () => {
  it('removes the confirmation on yes', () => {
    const next = run(withoutKeyboard(), [press(Intent.Up), press(Intent.Confirm)])
    expect(topFrame(next.state).layers).toEqual([])
  })

  it('removes the confirmation on no', () => {
    expect(topFrame(run(withoutKeyboard(), [press(Intent.Confirm)]).state).layers).toEqual([])
  })
})

describe('keyboard layer below the abandon confirmation', () => {
  it('still answers TextInputFocused for its field', () => {
    const next = transition(asking(), { type: PageCommandType.TextInputFocused, itemId: 'note' }, NOW)
    expect(next.effects).toEqual([TEXT_ENTRY_ON])
  })

  it('ignores TextInputFocused for another field', () => {
    expect(transition(asking(), { type: PageCommandType.TextInputFocused, itemId: 'other' }, NOW).effects).toEqual([])
  })

  it('ignores ClickKey: the confirmation takes the input', () => {
    const state = asking()
    expect(transition(state, { type: PageCommandType.ClickKey, row: 0, unit: 0 }, NOW)).toEqual({ state, effects: [] })
  })

  it('ends the text entry at the pause and starts it again, focused, at the resume', () => {
    const paused = transition(asking(), PAUSED(true), NOW)
    expect(paused.effects).toContainEqual(TEXT_ENTRY_OFF)
    const resumed = transition(paused.state, PAUSED(false), NOW)
    expect(resumed.effects).toEqual([sendToHost({ type: FromPage.Paused, paused: false }), TEXT_ENTRY_ON, FOCUS_NOTE])
  })
})
