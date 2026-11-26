import { describe, expect, it } from 'vitest'
import { keyboardView, type KeyView } from '../../../../src/page/application/views/keyboard-view'
import { KeyAction, KeyboardLanguage, KeyboardLayer, KEYBOARD_ROW_UNITS } from '../../../../src/page/domain/keyboard-layouts'
import { LayerKind, type VirtualKeyboardLayer } from '../../../../src/page/domain/ui-state'
import { openKeyboard, type KeyboardState } from '../../../../src/page/domain/virtual-keyboard'
import { hasFunction, isDeeplyFrozen, translate } from './column-fixtures'

const LIMIT = 40
const TWELVE = 'abcdefghijkl'
const SPACE_ROW = 3
const SHIFT_ROW = 2
const WITHIN_SPACE = 5
const COMMA = 2
const SPACE = 3
const PERIOD = 7
const SUBMIT = 8
const BOTTOM_UNITS = [0, COMMA, SPACE, PERIOD, SUBMIT]

function layerOf(change: Partial<KeyboardState> = {}, language: KeyboardLanguage = KeyboardLanguage.French): VirtualKeyboardLayer {
  return { kind: LayerKind.Keyboard, itemId: 'identifier', initialValue: '', keyboard: { ...openKeyboard(language, '', LIMIT), ...change } }
}

function view(change: Partial<KeyboardState> = {}, language: KeyboardLanguage = KeyboardLanguage.French): ReturnType<typeof keyboardView> {
  return keyboardView(layerOf(change, language), language, translate)
}

function flat(rendered: ReturnType<typeof keyboardView>): readonly KeyView[] {
  return rendered.rows.flat()
}

describe('keyboardView layout', () => {
  it('renders four rows of ten units', () => {
    const { rows } = view()
    expect(rows).toHaveLength(SPACE_ROW + 1)
    rows.forEach((row) => expect(row.reduce((sum, key) => sum + key.units, 0)).toBe(KEYBOARD_ROW_UNITS))
  })

  it('gives each key its row and first unit', () => {
    const bottom = view().rows[SPACE_ROW] ?? []
    expect(bottom.map((key) => key.unit)).toEqual(BOTTOM_UNITS)
    expect(bottom.every((key) => key.row === SPACE_ROW)).toBe(true)
  })

  it('uses the layout of the given language', () => {
    expect(view({}, KeyboardLanguage.French).rows[0]?.[0]?.text).toBe('a')
    expect(view({}, KeyboardLanguage.English).rows[0]?.[0]?.text).toBe('q')
  })

  it('renders the accents and the symbols layers', () => {
    expect(view({ layer: KeyboardLayer.AccentsDigits }).rows[0]?.[0]?.text).toBe('1')
    expect(view({ layer: KeyboardLayer.Symbols }).rows[0]?.[0]?.text).toBe('@')
  })

  it('names the current layer', () => {
    expect(view().layerName).toBe('Lettres')
    expect(view({ layer: KeyboardLayer.AccentsDigits }).layerName).toBe('Accents et chiffres')
    expect(view({ layer: KeyboardLayer.Symbols }).layerName).toBe('Symboles')
  })

  it('labels action keys with their meaning', () => {
    const keys = flat(view())
    const label = (action: KeyAction): string | undefined => keys.find((key) => key.action === action)?.label
    expect(label(KeyAction.Erase)).toBe('Effacer')
    expect(label(KeyAction.Space)).toBe('Espace')
    expect(label(KeyAction.Submit)).toBe('Valider')
    expect(label(KeyAction.Shift)).toBe('⇧')
  })

  it('labels the layer key with the layer it leads to, wrapping around', () => {
    const layerKey = (layer: KeyboardLayer): string | undefined => flat(view({ layer })).find((key) => key.action === KeyAction.Layer)?.label
    expect(layerKey(KeyboardLayer.Letters)).toBe('Accents et chiffres')
    expect(layerKey(KeyboardLayer.AccentsDigits)).toBe('Symboles')
    expect(layerKey(KeyboardLayer.Symbols)).toBe('Lettres')
  })
})

describe('keyboardView focus and shift', () => {
  it('focuses exactly one key', () => {
    expect(flat(view()).filter((key) => key.focused)).toHaveLength(1)
  })

  it('focuses the first key at the start', () => {
    expect(flat(view()).find((key) => key.focused)).toMatchObject({ row: 0, unit: 0 })
  })

  it('focuses a wide key from any of its units', () => {
    const focused = flat(view({ row: SPACE_ROW, unit: WITHIN_SPACE })).find((key) => key.focused)
    expect(focused).toMatchObject({ row: SPACE_ROW, unit: 3, action: KeyAction.Space })
  })

  it('shows uppercase characters and an active shift key when shifted', () => {
    const keys = flat(view({ shift: true }))
    expect(keys[0]?.text).toBe('A')
    expect(keys.find((key) => key.action === KeyAction.Shift)?.active).toBe(true)
    expect(view({ row: SHIFT_ROW }).rows[SHIFT_ROW]?.[0]?.active).toBe(false)
    expect(view().shift).toBe(false)
    expect(view({ shift: true }).shift).toBe(true)
  })

  it('does not mark character keys active', () => {
    expect(flat(view({ shift: true })).filter((key) => key.active)).toHaveLength(1)
  })
})

describe('keyboardView text field', () => {
  it('renders the whole value with the cursor at its end', () => {
    expect(view({ value: TWELVE })).toMatchObject({ itemId: 'identifier', value: TWELVE, cursor: TWELVE.length })
  })

  it('shows the counter', () => {
    expect(view({ value: TWELVE })).toMatchObject({ counterText: '12 / 40', length: 12, maxLength: LIMIT, atLimit: false })
  })

  it('flags the limit', () => {
    expect(view({ value: 'a'.repeat(LIMIT) })).toMatchObject({ counterText: '40 / 40', atLimit: true })
  })

  it('flags an empty keyboard with no room', () => {
    expect(view({ maxLength: 0 })).toMatchObject({ counterText: '0 / 0', atLimit: true })
  })

  it('is deeply frozen and carries no function', () => {
    const rendered = view({ value: TWELVE })
    expect(isDeeplyFrozen(rendered)).toBe(true)
    expect(hasFunction(rendered)).toBe(false)
  })
})
