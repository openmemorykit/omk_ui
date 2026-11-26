import { describe, expect, it } from 'vitest'
import { Intent } from '../../../src/protocol/intents'
import { BindingKind, BOUND_KEY_CODES, decodeBinding, KeyCode, KeyOutcomeKind, mapKey } from '../../../src/page/domain/key-map'
import type { KeyOutcome, KeyPress } from '../../../src/page/domain/key-map'

const BINDINGS = { radial: 't_G', interact: 't_E', pushToTalk: 't_N' }
const press = (code: string, overrides: Partial<KeyPress> = {}): KeyPress => ({ code, key: '', shift: false, inTextField: false, ...overrides })
const intent = (value: Intent): KeyOutcome => ({ kind: KeyOutcomeKind.Intent, intent: value })
const NOTHING: KeyOutcome = { kind: KeyOutcomeKind.None }

describe('mapKey', () => {
  it.each([
    [KeyCode.ArrowUp, Intent.Up],
    [KeyCode.ArrowDown, Intent.Down],
    [KeyCode.ArrowLeft, Intent.Left],
    [KeyCode.ArrowRight, Intent.Right],
  ])('maps %s to an intent even in a text field', (code, expected) => {
    expect(mapKey(press(code), BINDINGS)).toEqual(intent(expected))
    expect(mapKey(press(code, { inTextField: true }), BINDINGS)).toEqual(intent(expected))
  })

  it.each([
    [KeyCode.KeyW, Intent.Up],
    [KeyCode.KeyS, Intent.Down],
    [KeyCode.KeyA, Intent.Left],
    [KeyCode.KeyD, Intent.Right],
    [KeyCode.KeyQ, Intent.TabPrev],
    [KeyCode.KeyE, Intent.TabNext],
  ])('maps %s outside text fields only', (code, expected) => {
    expect(mapKey(press(code, { key: 'x' }), BINDINGS)).toEqual(intent(expected))
    expect(mapKey(press(code, { key: 'x', inTextField: true }), BINDINGS)).toEqual(NOTHING)
  })

  it('maps Enter to confirm, also in a text field', () => {
    expect(mapKey(press(KeyCode.Enter), BINDINGS)).toEqual(intent(Intent.Confirm))
    expect(mapKey(press(KeyCode.Enter, { inTextField: true }), BINDINGS)).toEqual(intent(Intent.Confirm))
  })

  it('maps Space to confirm outside a text field and nothing inside', () => {
    expect(mapKey(press(KeyCode.Space, { key: ' ' }), BINDINGS)).toEqual(intent(Intent.Confirm))
    expect(mapKey(press(KeyCode.Space, { key: ' ', inTextField: true }), BINDINGS)).toEqual(NOTHING)
  })

  it('maps Escape to back', () => {
    expect(mapKey(press(KeyCode.Escape), BINDINGS)).toEqual(intent(Intent.Back))
  })

  it('maps Tab and Shift+Tab', () => {
    expect(mapKey(press(KeyCode.Tab), BINDINGS)).toEqual(intent(Intent.TabNext))
    expect(mapKey(press(KeyCode.Tab, { shift: true }), BINDINGS)).toEqual(intent(Intent.TabPrev))
  })

  it('maps Backspace to nothing', () => {
    expect(mapKey(press(KeyCode.Backspace), BINDINGS)).toEqual(NOTHING)
    expect(mapKey(press(KeyCode.Backspace, { inTextField: true }), BINDINGS)).toEqual(NOTHING)
  })

  it('maps the radial text binding to radial, case insensitive, outside text fields', () => {
    expect(mapKey(press('KeyG', { key: 'g' }), BINDINGS)).toEqual(intent(Intent.Radial))
    expect(mapKey(press('KeyG', { key: 'G' }), BINDINGS)).toEqual(intent(Intent.Radial))
    expect(mapKey(press('KeyG', { key: 'g', inTextField: true }), BINDINGS)).toEqual(NOTHING)
  })

  it('maps a radial code binding b_170 to F1', () => {
    const bindings = { ...BINDINGS, radial: 'b_170' }
    expect(mapKey(press(KeyCode.F1), bindings)).toEqual(intent(Intent.Radial))
    expect(mapKey(press(KeyCode.F1, { inTextField: true }), bindings)).toEqual(intent(Intent.Radial))
    expect(mapKey(press(KeyCode.Enter), bindings)).toEqual(intent(Intent.Confirm))
  })

  it('maps the push to talk binding to push to talk, never an intent', () => {
    expect(mapKey(press('KeyN', { key: 'n' }), BINDINGS)).toEqual({ kind: KeyOutcomeKind.PushToTalk })
    expect(mapKey(press('KeyN', { key: 'n', inTextField: true }), BINDINGS)).toEqual(NOTHING)
  })

  it('gives push to talk priority over a navigation key it is bound to', () => {
    const bindings = { ...BINDINGS, pushToTalk: 't_W' }
    expect(mapKey(press(KeyCode.KeyW, { key: 'w' }), bindings)).toEqual({ kind: KeyOutcomeKind.PushToTalk })
  })

  it('ignores unknown and empty bindings', () => {
    const bindings = { radial: 'b_999', interact: '', pushToTalk: '' }
    expect(mapKey(press('KeyG', { key: 'g' }), bindings)).toEqual(NOTHING)
    expect(mapKey(press(KeyCode.F1, { key: '' }), bindings)).toEqual(NOTHING)
  })
})

describe('decodeBinding', () => {
  it('decodes a text binding', () => {
    expect(decodeBinding('t_G')).toEqual({ kind: BindingKind.Text, text: 'G' })
  })

  it('decodes a known code binding', () => {
    expect(decodeBinding('b_170')).toEqual({ kind: BindingKind.Known, code: 'F1' })
    expect(decodeBinding('b_194')).toEqual({ kind: BindingKind.Known, code: 'ArrowUp' })
  })

  it('keeps the exact bound key codes', () => {
    expect(BOUND_KEY_CODES).toEqual({ 170: 'F1', 194: 'ArrowUp', 102: 'MouseMiddle' })
  })

  it.each(['b_999', '', 't_', 'b_', 'b_constructor', 'b___proto__', 'b_-170', 'b_1e2', 'b_170 ', 'x_G', 'b_99999999999999999999'])(
    'marks %j as unknown',
    (raw) => {
      expect(decodeBinding(raw)).toEqual({ kind: BindingKind.Unknown, raw })
    },
  )
})
