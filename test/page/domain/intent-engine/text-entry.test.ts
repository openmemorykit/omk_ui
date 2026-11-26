import { describe, expect, it } from 'vitest'
import { BACK_HOLD_MS } from '../../../../src/page/domain/hold-detector'
import { transition } from '../../../../src/page/domain/intent-engine'
import { KeyboardLanguage } from '../../../../src/page/domain/keyboard-layouts'
import { PageCommandType, TimerKind, type UiCommand } from '../../../../src/page/domain/page-commands'
import { UiEffectType, type UiEffect } from '../../../../src/page/domain/ui-effects'
import { LayerKind, type UiState } from '../../../../src/page/domain/ui-state'
import { openKeyboard } from '../../../../src/page/domain/virtual-keyboard'
import { FromPage } from '../../../../src/protocol/from-page'
import { Intent } from '../../../../src/protocol/intents'
import { ToPage } from '../../../../src/protocol/to-page'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_GARAGE_RADIAL_ENTRY, OWNED_LIST_PANEL } from '../../../fixtures/owned'
import { menuPanel } from '../navigation-helpers'
import { bootWith, NOW, OPEN_RADIAL, press, pushPanel, radialEntries, run, sentOf, timerFired, withPanels, type Run } from './engine-helpers'

const KEYBOARD_MAX_LENGTH = 64
const NEXT_SEQ = 3
const TEXT_ENTRY_OFF: UiEffect = { type: UiEffectType.SendToHost, message: { type: FromPage.TextEntry, active: false } }
const BLURRED: UiCommand = { type: PageCommandType.WindowBlurred }

function typing(): UiState {
  const state = withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL])
  const [list, add] = state.stack
  if (list === undefined || add === undefined) throw new Error('two frames expected')
  const keyboard = { kind: LayerKind.Keyboard, itemId: 'identifier', initialValue: '', keyboard: openKeyboard(KeyboardLanguage.English, '', KEYBOARD_MAX_LENGTH) } as const
  return { ...state, stack: [list, { ...add, layers: [keyboard] }] }
}

function textEntries(effects: readonly UiEffect[]): readonly unknown[] {
  return sentOf(effects, FromPage.TextEntry)
}

describe('TextEntry when the keyboard layer goes away', () => {
  it('ends the text entry once at the pause', () => {
    const paused = transition(typing(), BLURRED, NOW)
    expect(paused.effects).toEqual([{ type: UiEffectType.SendToHost, message: { type: FromPage.Paused, paused: true } }, TEXT_ENTRY_OFF])
    expect(transition(paused.state, BLURRED, NOW).effects).toEqual([])
  })

  it('says nothing at the pause without a keyboard layer', () => {
    expect(textEntries(transition(withPanels([OWNED_LIST_PANEL]), BLURRED, NOW).effects)).toEqual([])
  })

  it('says nothing again when a paused page loses its keyboard layer', () => {
    const paused = transition(typing(), BLURRED, NOW).state
    const closed = transition(paused, { type: ToPage.ClosePanel, commandSeq: NEXT_SEQ, panelId: OWNED_ADD_PANEL.panel.id }, NOW)
    expect(textEntries(closed.effects)).toEqual([])
  })

  it('ends the text entry after the Event that closes the keyboard frame', () => {
    const next = transition(typing(), { type: ToPage.ClosePanel, commandSeq: NEXT_SEQ, panelId: OWNED_ADD_PANEL.panel.id }, NOW)
    expect(next.effects.map((effect) => (effect.type === UiEffectType.SendToHost ? effect.message.type : effect.type))).toEqual([FromPage.Event, FromPage.TextEntry])
    expect(next.effects[next.effects.length - 1]).toEqual(TEXT_ENTRY_OFF)
  })

  it.each<[string, (state: UiState) => Run]>([
    ['a held back closes everything', (state) => {
      const pressed = run(state, [press(Intent.Back)])
      const fired = run(pressed.state, [timerFired(TimerKind.BackHold)], NOW + BACK_HOLD_MS)
      return { state: fired.state, effects: pressed.effects.concat(fired.effects) }
    }],
    ['a radial selection empties the stack', (state) => run(state, [radialEntries([OWNED_GARAGE_RADIAL_ENTRY]), OPEN_RADIAL, press(Intent.Confirm)])],
    ['the owner is dropped', (state) => run(state, [{ type: ToPage.DropOwner, commandSeq: NEXT_SEQ, owner: FixtureOwner.Whitelist }])],
    ['a Boot rebuilds the stack', (state) => run(state, [bootWith({ commandSeq: NEXT_SEQ })])],
    ['a Boot throws', (state) => run(state, [bootWith({ commandSeq: NEXT_SEQ, locale: null as never })])],
    ['an Open replaces the stack', (state) => run(state, [{ type: ToPage.OpenPanel, commandSeq: NEXT_SEQ, panel: menuPanel('other') }])],
    ['a Push covers the keyboard frame', (state) => run(state, [pushPanel(menuPanel('child'), OWNED_ADD_PANEL.panel.id, state.appliedCommandSeq + 1)])],
    ['an update removes the text field', (state) => run(state, [{ type: ToPage.UpdatePanel, panel: { ...OWNED_ADD_PANEL, panel: { ...OWNED_ADD_PANEL.panel, items: OWNED_ADD_PANEL.panel.items.slice(1) } } }])],
  ])('ends the text entry exactly once when %s', (_, play) => {
    expect(textEntries(play(typing()).effects)).toEqual([{ type: FromPage.TextEntry, active: false }])
  })

  it('says nothing while the keyboard layer stays on top', () => {
    const update = { type: ToPage.UpdatePanel, panel: OWNED_ADD_PANEL } as const
    expect(textEntries(run(typing(), [update, press(Intent.Down)]).effects)).toEqual([])
  })
})
