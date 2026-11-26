import { describe, expect, it } from 'vitest'
import { Intent } from '../../../src/protocol/intents'
import { KeyAction, KeyboardLanguage, KeyboardLayer } from '../../../src/page/domain/keyboard-layouts'
import {
  eraseCharacter,
  focusedKey,
  insertSpace,
  insertText,
  moveKeyboardFocus,
  openKeyboard,
  pressFocusedKey,
  switchLayer,
  type KeyboardState,
} from '../../../src/page/domain/virtual-keyboard'

const EMOJI = '😀'
const BOTTOM_ROW = 3
const SHIFT_ROW = 2
const LAST_UNIT = 9
const SPACE_UNIT = 5
const LIMIT = 5
const ROOMY_LIMIT = 10
const WIDE_LIMIT = 20
const NEGATIVE_LIMIT = -4
const TWO_UNITS = 2
const THREE_UNITS = 3
const FOUR_UNITS = 4
const SWEEP_END = 8

function at(state: KeyboardState, row: number, unit: number): KeyboardState {
  return { ...state, row, unit }
}

function typed(state: KeyboardState, ...intents: Intent[]): KeyboardState {
  return intents.reduce(moveKeyboardFocus, state)
}

describe('openKeyboard', () => {
  it('starts on the first key of the letters layer', () => {
    const state = openKeyboard(KeyboardLanguage.French, 'ab', ROOMY_LIMIT)
    expect(state).toMatchObject({ layer: KeyboardLayer.Letters, row: 0, unit: 0, shift: false, value: 'ab', maxLength: 10 })
    expect(focusedKey(state).character).toBe('a')
  })

  it('truncates an over-long value without cutting a surrogate pair', () => {
    expect(openKeyboard(KeyboardLanguage.French, `a${EMOJI}`, TWO_UNITS).value).toBe('a')
    expect(openKeyboard(KeyboardLanguage.French, `a${EMOJI}`, THREE_UNITS).value).toBe(`a${EMOJI}`)
  })

  it('keeps accented characters and refuses an invalid limit', () => {
    expect(openKeyboard(KeyboardLanguage.French, 'éàü', THREE_UNITS).value).toBe('éàü')
    expect(openKeyboard(KeyboardLanguage.French, 'abc', Number.NaN).value).toBe('')
    expect(openKeyboard(KeyboardLanguage.French, 'abc', NEGATIVE_LIMIT).maxLength).toBe(0)
  })

  it('drops lone surrogates and control characters', () => {
    expect(openKeyboard(KeyboardLanguage.French, 'a\ud800b\nc', ROOMY_LIMIT).value).toBe('abc')
  })
})

describe('focus', () => {
  const start = openKeyboard(KeyboardLanguage.French, '', WIDE_LIMIT)

  it('wraps left and right', () => {
    expect(focusedKey(typed(start, Intent.Left)).character).toBe('p')
    expect(focusedKey(typed(at(start, 0, LAST_UNIT), Intent.Right)).character).toBe('a')
    expect(typed(start, Intent.Right).unit).toBe(1)
  })

  it('wraps over the wide keys of the bottom row', () => {
    const bottom = at(start, BOTTOM_ROW, 0)
    expect(focusedKey(bottom).action).toBe(KeyAction.Layer)
    expect(focusedKey(typed(bottom, Intent.Right)).character).toBe(',')
    expect(focusedKey(typed(bottom, Intent.Right, Intent.Right)).action).toBe(KeyAction.Space)
    expect(focusedKey(typed(bottom, Intent.Left)).action).toBe(KeyAction.Submit)
    expect(focusedKey(typed(at(start, BOTTOM_ROW, LAST_UNIT), Intent.Right)).action).toBe(KeyAction.Layer)
  })

  it('keeps the column going up and down over wide keys', () => {
    const onSpace = at(start, BOTTOM_ROW, SPACE_UNIT)
    expect(focusedKey(onSpace).action).toBe(KeyAction.Space)
    const above = typed(onSpace, Intent.Up)
    expect(above.unit).toBe(SPACE_UNIT)
    expect(focusedKey(above).character).toBe('b')
    const back = typed(above, Intent.Down)
    expect(focusedKey(back).action).toBe(KeyAction.Space)
    expect(focusedKey(typed(at(start, 0, LAST_UNIT), Intent.Down, Intent.Down, Intent.Down)).action).toBe(KeyAction.Submit)
  })

  it('stays on the first and last rows', () => {
    expect(typed(start, Intent.Up).row).toBe(0)
    expect(typed(at(start, BOTTOM_ROW, 0), Intent.Down).row).toBe(BOTTOM_ROW)
  })

  it('ignores other intents and does not mutate', () => {
    expect(typed(start, Intent.Confirm)).toBe(start)
    expect(start.unit).toBe(0)
  })
})

describe('pressing keys', () => {
  const start = openKeyboard(KeyboardLanguage.French, '', LIMIT)

  it('appends the focused character', () => {
    const { state, submitted, limitReached } = pressFocusedKey(start)
    expect(state.value).toBe('a')
    expect(submitted).toBe(false)
    expect(limitReached).toBe(false)
  })

  it('upper-cases one accented character then goes back to lower case', () => {
    const accents = switchLayer(start, 1)
    const onE = at(accents, 1, 0)
    const shifted = pressFocusedKey(at(onE, SHIFT_ROW, 0)).state
    expect(shifted.shift).toBe(true)
    const upper = pressFocusedKey({ ...shifted, row: 1, unit: 0 })
    expect(upper.state.value).toBe('É')
    expect(upper.state.shift).toBe(false)
    expect(pressFocusedKey(upper.state).state.value).toBe('Éé')
  })

  it('toggles shift off when pressed twice', () => {
    const onShift = at(start, SHIFT_ROW, 0)
    const twice = pressFocusedKey(pressFocusedKey(onShift).state).state
    expect(twice.shift).toBe(false)
  })

  it('erases through the erase key and eraseCharacter', () => {
    const filled = openKeyboard(KeyboardLanguage.French, 'ab', LIMIT)
    expect(pressFocusedKey(at(filled, SHIFT_ROW, LAST_UNIT)).state.value).toBe('a')
    expect(eraseCharacter(filled).value).toBe('a')
    expect(eraseCharacter(openKeyboard(KeyboardLanguage.French, '', LIMIT)).value).toBe('')
  })

  it('erases a whole emoji at once', () => {
    expect(eraseCharacter(openKeyboard(KeyboardLanguage.French, `a${EMOJI}`, LIMIT)).value).toBe('a')
  })

  it('inserts a space and reports the limit', () => {
    expect(insertSpace(start).state.value).toBe(' ')
    expect(pressFocusedKey(at(start, BOTTOM_ROW, SPACE_UNIT)).state.value).toBe(' ')
    const full = openKeyboard(KeyboardLanguage.French, 'abcde', LIMIT)
    expect(insertSpace(full)).toEqual({ state: full, submitted: false, limitReached: true })
  })

  it('refuses a key at the limit', () => {
    const full = openKeyboard(KeyboardLanguage.French, 'abcde', LIMIT)
    const result = pressFocusedKey(full)
    expect(result.limitReached).toBe(true)
    expect(result.state).toBe(full)
  })

  it('keeps shift armed when the limit refuses the key', () => {
    const full = { ...openKeyboard(KeyboardLanguage.French, 'abcde', LIMIT), shift: true }
    expect(pressFocusedKey(full).state.shift).toBe(true)
  })

  it('submits', () => {
    const result = pressFocusedKey(at(start, BOTTOM_ROW, LAST_UNIT))
    expect(result.submitted).toBe(true)
    expect(result.limitReached).toBe(false)
    expect(result.state.value).toBe('')
  })

  it('switches layer through the layer key', () => {
    expect(pressFocusedKey(at(start, BOTTOM_ROW, 0)).state.layer).toBe(KeyboardLayer.AccentsDigits)
  })
})

describe('switchLayer', () => {
  const start = openKeyboard(KeyboardLanguage.English, '', LIMIT)

  it('wraps in both directions', () => {
    expect(switchLayer(start, -1).layer).toBe(KeyboardLayer.Symbols)
    expect(switchLayer(switchLayer(start, -1), 1).layer).toBe(KeyboardLayer.Letters)
    expect(switchLayer(switchLayer(switchLayer(start, 1), 1), 1).layer).toBe(KeyboardLayer.Letters)
    expect(switchLayer(start, 1).layer).toBe(KeyboardLayer.AccentsDigits)
  })
})

describe('limit in UTF-16 units', () => {
  it('refuses an emoji one unit from the limit without cutting the pair', () => {
    const state = openKeyboard(KeyboardLanguage.French, 'abc', FOUR_UNITS)
    const result = insertText(state, EMOJI)
    expect(result.limitReached).toBe(true)
    expect(result.state).toBe(state)
    expect(result.state.value).toBe('abc')
  })

  it('accepts an emoji with two units left', () => {
    const result = insertText(openKeyboard(KeyboardLanguage.French, 'ab', FOUR_UNITS), EMOJI)
    expect(result.state.value).toBe(`ab${EMOJI}`)
    expect(result.limitReached).toBe(false)
  })

  it('inserts the longest prefix of whole code points that fits', () => {
    const result = insertText(openKeyboard(KeyboardLanguage.French, 'a', THREE_UNITS), `é${EMOJI}b`)
    expect(result.state.value).toBe('aé')
    expect(result.limitReached).toBe(true)
    for (const unit of result.state.value) expect(unit).not.toMatch(/^[\ud800-\udfff]$/)
  })

  it('counts accented characters as one unit', () => {
    const result = insertText(openKeyboard(KeyboardLanguage.French, '', THREE_UNITS), 'éàü')
    expect(result.state.value).toBe('éàü')
    expect(result.limitReached).toBe(false)
    expect(insertText(result.state, 'e').limitReached).toBe(true)
  })

  it('never leaves a lone surrogate whatever the limit', () => {
    for (let limit = 0; limit < SWEEP_END; limit += 1) {
      const { value } = insertText(openKeyboard(KeyboardLanguage.French, '', limit), `a${EMOJI}é${EMOJI}`).state
      expect(value.length).toBeLessThanOrEqual(limit)
      expect(Array.from(value).every((point) => !/^[\ud800-\udfff]$/.test(point))).toBe(true)
    }
  })

  it('drops lone surrogates, control characters and ignores empty text', () => {
    const state = openKeyboard(KeyboardLanguage.French, '', ROOMY_LIMIT)
    expect(insertText(state, 'a\ud83db\u0007\n').state.value).toBe('ab')
    expect(insertText(state, '')).toEqual({ state, submitted: false, limitReached: false })
  })

  it('resets shift only when something was inserted', () => {
    const shifted = { ...openKeyboard(KeyboardLanguage.French, '', ROOMY_LIMIT), shift: true }
    expect(insertText(shifted, 'x').state.shift).toBe(false)
  })
})
