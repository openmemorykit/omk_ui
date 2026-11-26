import { ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { transition } from '../../../../src/page/domain/intent-engine'
import { TYPED_TEXT_SCAN_UNITS } from '../../../../src/page/domain/keyboard-handler'
import { handleKeyboardLayer } from '../../../../src/page/domain/panel-handlers'
import { KeyboardLayer } from '../../../../src/page/domain/keyboard-layouts'
import { UiEffectType } from '../../../../src/page/domain/ui-effects'
import { ConfirmChoice, ConfirmOrigin, LayerKind, type UiState } from '../../../../src/page/domain/ui-state'
import type { KeyboardState } from '../../../../src/page/domain/virtual-keyboard'
import { Intent } from '../../../../src/protocol/intents'
import { IDENTIFIER_FIELD_MAX_LENGTH } from '../../../fixtures/items'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_LIST_PANEL } from '../../../fixtures/owned'
import { menuPanel } from '../navigation-helpers'
import { NOW, press, release, run, withPanels } from './engine-helpers'
import { BACK_HOLD_SCHEDULE, click, itemOf, NOTE_MENU, PLAIN_TEXT, REPEAT_SCHEDULE, replyEvent, TEXT_ENTRY_OFF, topFrame, topLayer, typeText } from './handler-helpers'

const OWNER = FixtureOwner.Whitelist
const NOTE_ID = NOTE_MENU.panel.id
const MAX_LENGTH = IDENTIFIER_FIELD_MAX_LENGTH
const TOO_LONG = 100
const HUGE_LENGTH = 2_000_000
const HUGE_BUDGET_MS = 250
const NOT_TEXT = 42
const FOCUS_NOTE = { type: UiEffectType.FocusTextInput, itemId: 'note' } as const

function typingNote(base: UiState = withPanels([NOTE_MENU])): UiState {
  return run(base, [press(Intent.Confirm)]).state
}

function keyboardOf(state: UiState): KeyboardState | null {
  const layer = topFrame(state).layers.find((candidate) => candidate.kind === LayerKind.Keyboard)
  return layer?.kind === LayerKind.Keyboard ? layer.keyboard : null
}

function valueOf(state: UiState): string | null {
  return keyboardOf(state)?.value ?? null
}

describe('keyboard layer: grid', () => {
  it('moves on the grid and presses the focused key', () => {
    const state = run(typingNote(), [press(Intent.Confirm), press(Intent.Right), press(Intent.Confirm), press(Intent.Down), press(Intent.Confirm)]).state
    expect(valueOf(state)).toBe('qws')
  })

  it('schedules the repeat of a held direction and says nothing else', () => {
    expect(transition(typingNote(), press(Intent.Right), NOW).effects).toEqual([REPEAT_SCHEDULE])
  })

  it('changes layer on tabNext and tabPrev', () => {
    const next = run(typingNote(), [press(Intent.TabNext)]).state
    expect(keyboardOf(next)?.layer).toBe(KeyboardLayer.AccentsDigits)
    expect(keyboardOf(run(next, [press(Intent.TabPrev), press(Intent.TabPrev)]).state)?.layer).toBe(KeyboardLayer.Symbols)
  })

  it('erases and inserts a space', () => {
    const state = run(typingNote(), [press(Intent.Confirm), press(Intent.Space), press(Intent.Confirm), press(Intent.Erase)]).state
    expect(valueOf(state)).toBe('q ')
  })
})

describe('keyboard layer: typed text', () => {
  it('replaces the value with the typed text', () => {
    expect(valueOf(run(typingNote(), [typeText('hello'), typeText('hello world')]).state)).toBe('hello world')
  })

  it('bounds the typed text to maxLength in UTF-16 units, without splitting a pair', () => {
    expect(valueOf(run(typingNote(), [typeText('a'.repeat(TOO_LONG))]).state)).toBe('a'.repeat(MAX_LENGTH))
    expect(valueOf(run(typingNote(), [typeText(`${'a'.repeat(MAX_LENGTH - 1)}\u{1F600}`)]).state)).toBe('a'.repeat(MAX_LENGTH - 1))
  })

  it('reads a huge typed text in bounded time', () => {
    const state = typingNote()
    const huge = 'b'.repeat(HUGE_LENGTH)
    transition(state, typeText(huge), NOW)
    const started = Date.now()
    const next = transition(state, typeText(huge), NOW)
    expect(Date.now() - started).toBeLessThan(HUGE_BUDGET_MS)
    expect(valueOf(next.state)).toBe('b'.repeat(MAX_LENGTH))
  })

  it('reads no further than the scan bound, so control characters cannot push the scan past it', () => {
    const padded = `${'\u0001'.repeat(TYPED_TEXT_SCAN_UNITS)}abc`
    expect(valueOf(run(typingNote(), [typeText(padded)]).state)).toBe('')
    expect(valueOf(run(typingNote(), [typeText(`${'\u0001'.repeat(TYPED_TEXT_SCAN_UNITS - 1)}abc`)]).state)).toBe('a')
  })

  it('ignores a typed value that is not text', () => {
    const state = typingNote()
    expect(handleKeyboardLayer(state, typeText(NOT_TEXT as never), NOW)).toEqual({ state, effects: [] })
  })
})

describe('keyboard layer: submit', () => {
  it('sends ValueChanged in a menu, keeps the value on the row and ends the text entry', () => {
    const next = transition(run(typingNote(), [typeText('hi')]).state, press(Intent.Submit), NOW)
    expect(next.effects).toEqual([replyEvent(OWNER, { kind: ReplyKind.ValueChanged, panelId: NOTE_ID, itemId: 'note', value: 'hi' }), TEXT_ENTRY_OFF])
    expect(topFrame(next.state).layers).toEqual([])
    const item = itemOf(next.state, 'note')
    expect(item !== undefined && 'value' in item ? item.value : null).toBe('hi')
  })

  it('submits from the submit key of the grid', () => {
    const typed = run(typingNote(), [typeText('hi')]).state
    const onSubmitKey = run(typed, [press(Intent.Down), press(Intent.Down), press(Intent.Down), press(Intent.Left)]).state
    expect(transition(onSubmitKey, press(Intent.Confirm), NOW).effects).toEqual([
      replyEvent(OWNER, { kind: ReplyKind.ValueChanged, panelId: NOTE_ID, itemId: 'note', value: 'hi' }),
      TEXT_ENTRY_OFF,
    ])
  })

  it('closes without ValueChanged when the text did not change', () => {
    expect(transition(typingNote(), press(Intent.Submit), NOW).effects).toEqual([TEXT_ENTRY_OFF])
  })

  it('keeps the value in the form, checks the field and sends nothing', () => {
    const typing = run(withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL]), [press(Intent.Confirm), typeText('nope')]).state
    const next = transition(typing, press(Intent.Submit), NOW)
    expect(next.effects).toEqual([TEXT_ENTRY_OFF])
    expect(topFrame(next.state).form?.values.identifier).toBe('nope')
    expect(Object.keys(topFrame(next.state).form?.errors ?? {})).toEqual(['identifier'])
  })
})

describe('keyboard layer: back', () => {
  it('closes at once when the text is unchanged', () => {
    const next = transition(typingNote(), press(Intent.Back), NOW)
    expect(next.effects).toEqual([BACK_HOLD_SCHEDULE, TEXT_ENTRY_OFF])
    expect(topFrame(next.state).layers).toEqual([])
  })

  it('asks to abandon the text when it changed, keeping the text entry on', () => {
    const next = transition(run(typingNote(), [typeText('draft')]).state, press(Intent.Back), NOW)
    expect(next.effects).toEqual([BACK_HOLD_SCHEDULE])
    const layer = topLayer(next.state)
    expect(layer?.kind === LayerKind.Confirm ? [layer.origin, layer.itemId, layer.choice, layer.confirmId] : null).toEqual([ConfirmOrigin.AbandonText, 'note', ConfirmChoice.Cancel, null])
  })

  it('goes back to the keyboard with the draft on no, focusing the input again', () => {
    const asking = run(typingNote(), [typeText('draft'), press(Intent.Back), release(Intent.Back)]).state
    const next = transition(asking, press(Intent.Confirm), NOW)
    expect(next.effects).toEqual([FOCUS_NOTE])
    expect(topLayer(next.state)?.kind).toBe(LayerKind.Keyboard)
    expect(valueOf(next.state)).toBe('draft')
    expect(transition(asking, press(Intent.Back), NOW).effects).toEqual([BACK_HOLD_SCHEDULE, FOCUS_NOTE])
  })

  it('closes without keeping the draft on yes, ending the text entry once', () => {
    const asking = run(typingNote(), [typeText('draft'), press(Intent.Back), press(Intent.Up)]).state
    const next = transition(asking, press(Intent.Confirm), NOW)
    expect(next.effects).toEqual([TEXT_ENTRY_OFF])
    expect(topFrame(next.state).layers).toEqual([])
    const item = itemOf(next.state, 'note')
    expect(item !== undefined && 'value' in item ? item.value : null).toBe('')
  })

  it('checks the form field when the abandoned keyboard closes', () => {
    const asking = run(withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL]), [press(Intent.Confirm), typeText('x'), press(Intent.Back), click(ConfirmChoice.Confirm)]).state
    expect(topFrame(asking).form?.values.identifier).toBe('')
    expect(Object.keys(topFrame(asking).form?.errors ?? {})).toEqual(['identifier'])
  })
})

describe('keyboard layer: guards', () => {
  it('ignores hovering and clicking', () => {
    const state = typingNote()
    expect(handleKeyboardLayer(state, click('note'), NOW)).toEqual({ state, effects: [] })
  })

  it('does nothing without a keyboard layer on top', () => {
    const state = withPanels([menuPanel('other', OWNER, [PLAIN_TEXT])])
    expect(handleKeyboardLayer(state, press(Intent.Confirm), NOW)).toEqual({ state, effects: [] })
  })
})
