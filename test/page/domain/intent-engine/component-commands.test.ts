import { ItemKind, type Item } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { currentFieldValue } from '../../../../src/page/domain/field-values'
import { transition } from '../../../../src/page/domain/intent-engine'
import { KeyboardLayer, keyboardLayout } from '../../../../src/page/domain/keyboard-layouts'
import { PageCommandType, type UiCommand } from '../../../../src/page/domain/page-commands'
import { UiEffectType, type UiEffect } from '../../../../src/page/domain/ui-effects'
import type { KeyboardState } from '../../../../src/page/domain/virtual-keyboard'
import { LayerKind, type UiState } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { Intent } from '../../../../src/protocol/intents'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_LIST_PANEL } from '../../../fixtures/owned'
import { menuPanel } from '../navigation-helpers'
import { NOW, press, run, withPanels } from './engine-helpers'
import { NOTE_MENU, TEXT_ENTRY_ON, topFrame } from './handler-helpers'

const BLURRED: UiCommand = { type: PageCommandType.WindowBlurred }
const FOCUSED: UiCommand = { type: PageCommandType.WindowFocused }
const PAUSED_OFF: UiEffect = { type: UiEffectType.SendToHost, message: { type: FromPage.Paused, paused: false } }
const FOCUS_NOTE: UiEffect = { type: UiEffectType.FocusTextInput, itemId: 'note' }
const OUT_OF_RANGE = 99
const FRACTION = 0.5
const SPACE_INSIDE_UNIT = 5
const SPACE_START_UNIT = 3
const SUBMIT_UNIT = 9
const THIRD_KEY_UNIT = 2
const SECOND_ROW = 1
const FOURTH_KEY_UNIT = 3
const KEY_LAYERS = Object.values(KeyboardLayer)

const textInputFocused = (itemId: string): UiCommand => ({ type: PageCommandType.TextInputFocused, itemId })
const clickKey = (row: number, unit: number): UiCommand => ({ type: PageCommandType.ClickKey, row, unit })
const stepItem = (itemId: string, step: 1 | -1): UiCommand => ({ type: PageCommandType.StepItem, itemId, step })

function typing(): UiState {
  return run(withPanels([NOTE_MENU]), [press(Intent.Confirm)]).state
}

function keyboardOf(state: UiState): KeyboardState {
  const layer = topFrame(state).layers.find((candidate) => candidate.kind === LayerKind.Keyboard)
  if (layer?.kind !== LayerKind.Keyboard) throw new Error('keyboard layer expected')
  return layer.keyboard
}

function onLayer(layer: KeyboardLayer): UiState {
  const state = typing()
  const index = KEY_LAYERS.indexOf(layer)
  return run(state, Array.from({ length: index }, () => press(Intent.TabNext))).state
}

function roleOf(state: UiState): unknown {
  const frame = topFrame(state)
  const role = frame.panel?.panel.items.find((item) => item.kind === ItemKind.Cycle)
  return role?.kind === ItemKind.Cycle ? currentFieldValue(frame, role) : undefined
}

describe('TextInputFocused', () => {
  it('confirms the text entry when the keyboard layer of that item is on top', () => {
    expect(transition(typing(), textInputFocused('note'), NOW).effects).toEqual([TEXT_ENTRY_ON])
  })

  it('does nothing without a keyboard layer', () => {
    const state = withPanels([NOTE_MENU])
    const next = transition(state, textInputFocused('note'), NOW)
    expect(next.state).toBe(state)
    expect(next.effects).toEqual([])
  })

  it('does nothing for another item', () => {
    expect(transition(typing(), textInputFocused('other'), NOW).effects).toEqual([])
  })

  it('does nothing while paused', () => {
    const paused = transition(typing(), BLURRED, NOW).state
    expect(transition(paused, textInputFocused('note'), NOW).effects).toEqual([])
  })
})

describe('WindowFocused', () => {
  it('returns from the pause with the text entry and the input focus when a keyboard layer is on top', () => {
    const paused = transition(typing(), BLURRED, NOW).state
    const next = transition(paused, FOCUSED, NOW)
    expect(next.state.paused).toBe(false)
    expect(next.effects).toEqual([PAUSED_OFF, TEXT_ENTRY_ON, FOCUS_NOTE])
  })

  it('only leaves the pause without a keyboard layer', () => {
    const paused = transition(withPanels([OWNED_LIST_PANEL]), BLURRED, NOW).state
    expect(transition(paused, FOCUSED, NOW).effects).toEqual([PAUSED_OFF])
  })

  it('says nothing when the page was not paused, even over a keyboard layer', () => {
    expect(transition(typing(), FOCUSED, NOW).effects).toEqual([])
  })
})

describe('ClickKey', () => {
  it.each(KEY_LAYERS)('moves the focus onto the clicked key and applies it on the %s layer', (layer) => {
    const state = onLayer(layer)
    const { language } = keyboardOf(state)
    const rows = keyboardLayout(language, layer)
    const row = 0
    const key = rows[row]?.[THIRD_KEY_UNIT]
    if (key === undefined) throw new Error('key expected')
    const next = transition(state, clickKey(row, THIRD_KEY_UNIT), NOW).state
    const keyboard = keyboardOf(next)
    expect([keyboard.row, keyboard.unit]).toEqual([row, THIRD_KEY_UNIT])
    expect(keyboard.value).toBe(key.character ?? '')
  })

  it('applies the same effect as confirming that key', () => {
    const viaClick = transition(typing(), clickKey(SECOND_ROW, FOURTH_KEY_UNIT), NOW).state
    const viaIntents = run(typing(), [press(Intent.Down), press(Intent.Right), press(Intent.Right), press(Intent.Right), press(Intent.Confirm)]).state
    expect(keyboardOf(viaClick)).toEqual(keyboardOf(viaIntents))
  })

  it('lands on the start of a wide key when the unit falls inside it', () => {
    const state = typing()
    const bottom = keyboardLayout(keyboardOf(state).language, KeyboardLayer.Letters).length - 1
    const keyboard = keyboardOf(transition(state, clickKey(bottom, SPACE_INSIDE_UNIT), NOW).state)
    expect([keyboard.row, keyboard.unit]).toEqual([bottom, SPACE_START_UNIT])
    expect(keyboard.value).toBe(' ')
  })

  it.each([
    ['row below range', clickKey(-1, 0)],
    ['row above range', clickKey(OUT_OF_RANGE, 0)],
    ['unit below range', clickKey(0, -1)],
    ['unit above range', clickKey(0, OUT_OF_RANGE)],
    ['fractional row', clickKey(FRACTION, 0)],
    ['fractional unit', clickKey(0, FRACTION)],
    ['NaN unit', clickKey(0, Number.NaN)],
  ])('does nothing on a missing position: %s', (_name, command) => {
    const state = typing()
    const next = transition(state, command, NOW)
    expect(next.state).toBe(state)
    expect(next.effects).toEqual([])
  })

  it('does nothing without a keyboard layer', () => {
    const state = withPanels([NOTE_MENU])
    const next = transition(state, clickKey(0, 0), NOW)
    expect(next.state).toBe(state)
    expect(next.effects).toEqual([])
  })

  it('does nothing while paused', () => {
    const paused = transition(typing(), BLURRED, NOW).state
    const next = transition(paused, clickKey(0, 0), NOW)
    expect(next.state).toBe(paused)
  })

  it('submits when the clicked key is the submit key', () => {
    const state = typing()
    const rows = keyboardLayout(keyboardOf(state).language, KeyboardLayer.Letters)
    const bottom = rows.length - 1
    const next = transition(state, clickKey(bottom, SUBMIT_UNIT), NOW)
    expect(topFrame(next.state).layers).toEqual([])
  })
})

describe('StepItem', () => {
  const formWithRole = (): UiState => withPanels([OWNED_ADD_PANEL])

  it('steps a cycle forward, moves the focus onto it and replies', () => {
    const next = transition(formWithRole(), stepItem('role', 1), NOW)
    expect(topFrame(next.state).focusItemId).toBe('role')
    expect(roleOf(next.state)).toBe('staff')
  })

  it('wraps a cycle backward from its first option', () => {
    const next = transition(formWithRole(), stepItem('role', -1), NOW)
    expect(roleOf(next.state)).toBe('staff')
  })

  it('wraps forward from the last option', () => {
    const twice = run(formWithRole(), [stepItem('role', 1), stepItem('role', 1)]).state
    expect(roleOf(twice)).toBe('member')
  })

  it('steps back to the previous option', () => {
    const back = run(formWithRole(), [stepItem('role', 1), stepItem('role', -1)]).state
    expect(roleOf(back)).toBe('member')
  })

  it('does nothing on an item that is not a cycle', () => {
    const state = formWithRole()
    const next = transition(state, stepItem('notify', 1), NOW)
    expect(next.state).toBe(state)
    expect(next.effects).toEqual([])
  })

  it('does nothing on an unknown identifier', () => {
    const state = formWithRole()
    expect(transition(state, stepItem('missing', 1), NOW).state).toBe(state)
  })

  it('does nothing on an inherited key', () => {
    const state = formWithRole()
    expect(transition(state, stepItem('constructor', 1), NOW).state).toBe(state)
  })

  it('does nothing while paused', () => {
    const paused = transition(formWithRole(), BLURRED, NOW).state
    expect(transition(paused, stepItem('role', 1), NOW).state).toBe(paused)
  })

  it('does nothing on a disabled cycle', () => {
    const disabled: Item = { kind: ItemKind.Cycle, id: 'role', label: 'Role', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], value: 'a', disabled: { reason: 'Locked' } }
    const state = withPanels([menuPanel('cycles', FixtureOwner.Whitelist, [disabled])])
    const next = transition(state, stepItem('role', 1), NOW)
    expect(next.effects).toEqual([])
    expect(roleOf(next.state)).toBe('a')
  })

  it('sends the value change of a cycle outside a form', () => {
    const cycle: Item = { kind: ItemKind.Cycle, id: 'role', label: 'Role', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], value: 'a' }
    const state = withPanels([menuPanel('cycles', FixtureOwner.Whitelist, [cycle])])
    const next = transition(state, stepItem('role', 1), NOW)
    expect(next.effects).toHaveLength(1)
    expect(roleOf(next.state)).toBe('b')
  })
})
