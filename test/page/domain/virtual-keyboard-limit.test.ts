import { describe, expect, it } from 'vitest'
import { KeyboardLanguage } from '../../../src/page/domain/keyboard-layouts'
import { insertText, openKeyboard } from '../../../src/page/domain/virtual-keyboard'

const EMOJI = '😀'
const LIMIT = 5
const ROOMY_LIMIT = 10
const THREE_UNITS = 3
const FOUR_UNITS = 4
const SWEEP_END = 8
const HUGE_TEXT_LENGTH = 5_000_000
const HUGE_TEXT_BUDGET_MS = 50

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

  it('stops reading a huge text once the limit is reached', () => {
    const full = openKeyboard(KeyboardLanguage.French, 'abcde', LIMIT)
    const huge = 'x'.repeat(HUGE_TEXT_LENGTH)
    insertText(full, huge)
    const start = performance.now()
    const result = insertText(full, huge)
    expect(performance.now() - start).toBeLessThan(HUGE_TEXT_BUDGET_MS)
    expect(result).toEqual({ state: full, submitted: false, limitReached: true })
  })

  it('reports the limit when the text is cut, and not when it fits exactly', () => {
    const state = openKeyboard(KeyboardLanguage.French, 'ab', LIMIT)
    expect(insertText(state, `cde${EMOJI}`)).toMatchObject({ state: { value: 'abcde' }, limitReached: true })
    expect(insertText(state, 'cde')).toMatchObject({ state: { value: 'abcde' }, limitReached: false })
    expect(insertText(state, `c\u0007de`)).toMatchObject({ state: { value: 'abcde' }, limitReached: false })
  })

  it('resets shift only when something was inserted', () => {
    const shifted = { ...openKeyboard(KeyboardLanguage.French, '', ROOMY_LIMIT), shift: true }
    expect(insertText(shifted, 'x').state.shift).toBe(false)
  })
})
