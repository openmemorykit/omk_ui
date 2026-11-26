import { describe, expect, it } from 'vitest'
import {
  KEYBOARD_ROW_UNITS,
  KeyAction,
  KeyboardLanguage,
  KeyboardLayer,
  keyboardLayout,
} from '../../../src/page/domain/keyboard-layouts'

const languages = Object.values(KeyboardLanguage)
const layers = Object.values(KeyboardLayer)

function characters(language: KeyboardLanguage, layer: KeyboardLayer, rowIndex: number): string {
  return (keyboardLayout(language, layer)[rowIndex] ?? []).map((key) => key.character ?? `<${key.action}>`).join(' ')
}

const ROW_COUNT = 4
const THIRD_ROW = 2
const BOTTOM_ROW = 3
const WIDE_UNITS = 2
const SPACE_UNITS = 4

describe('keyboard layouts', () => {
  it.each(languages)('contains every required character in %s', (language) => {
    const all = layers.flatMap((layer) => keyboardLayout(language, layer).flat().map((key) => key.character))
    for (const required of Array.from("éèêëàâùûüîïôœçù'-_@?!:")) expect(all).toContain(required)
  })

  it.each(languages)('makes every row of %s exactly one row of units', (language) => {
    for (const layer of layers) {
      for (const row of keyboardLayout(language, layer)) {
        expect(row.reduce((sum, key) => sum + key.units, 0)).toBe(KEYBOARD_ROW_UNITS)
      }
    }
  })

  it('has four rows per layer', () => {
    for (const language of languages) for (const layer of layers) expect(keyboardLayout(language, layer)).toHaveLength(ROW_COUNT)
  })

  it('matches the French letters layer', () => {
    expect(characters(KeyboardLanguage.French, KeyboardLayer.Letters, 0)).toBe('a z e r t y u i o p')
    expect(characters(KeyboardLanguage.French, KeyboardLayer.Letters, 1)).toBe('q s d f g h j k l m')
    expect(characters(KeyboardLanguage.French, KeyboardLayer.Letters, THIRD_ROW)).toBe("<shift> w x c v b n ' - <erase>")
  })

  it('matches the English letters layer', () => {
    expect(characters(KeyboardLanguage.English, KeyboardLayer.Letters, 0)).toBe('q w e r t y u i o p')
    expect(characters(KeyboardLanguage.English, KeyboardLayer.Letters, 1)).toBe("a s d f g h j k l '")
    expect(characters(KeyboardLanguage.English, KeyboardLayer.Letters, THIRD_ROW)).toBe('<shift> z x c v b n m - <erase>')
  })

  it('matches the accents and symbols layers', () => {
    const accents = KeyboardLayer.AccentsDigits
    const symbols = KeyboardLayer.Symbols
    expect(characters(KeyboardLanguage.French, accents, 0)).toBe('1 2 3 4 5 6 7 8 9 0')
    expect(characters(KeyboardLanguage.French, accents, 1)).toBe('é è ê ë à â ç ù û ü')
    expect(characters(KeyboardLanguage.French, accents, THIRD_ROW)).toBe('<shift> î ï ô œ æ « » " <erase>')
    expect(characters(KeyboardLanguage.English, symbols, 0)).toBe('@ # & / * + = % € $')
    expect(characters(KeyboardLanguage.English, symbols, 1)).toBe('( ) [ ] _ ; : ? ! ~')
    expect(characters(KeyboardLanguage.English, symbols, THIRD_ROW)).toBe('<shift> < > { } | \\ ^ ° <erase>')
  })

  it('has the same bottom row everywhere', () => {
    for (const language of languages) {
      for (const layer of layers) {
        const bottom = keyboardLayout(language, layer)[BOTTOM_ROW] ?? []
        expect(bottom.map((key) => [key.action, key.character, key.units])).toEqual([
          [KeyAction.Layer, null, WIDE_UNITS],
          [KeyAction.Character, ',', 1],
          [KeyAction.Space, null, SPACE_UNITS],
          [KeyAction.Character, '.', 1],
          [KeyAction.Submit, null, WIDE_UNITS],
        ])
      }
    }
  })

  it('is frozen', () => {
    const layout = keyboardLayout(KeyboardLanguage.French, KeyboardLayer.Letters)
    expect(Object.isFrozen(layout)).toBe(true)
    expect(Object.isFrozen(layout[0])).toBe(true)
  })
})
