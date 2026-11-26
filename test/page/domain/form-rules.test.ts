import { describe, expect, it } from 'vitest'
import { ItemKind, RuleKind, TextFormat, type Rule } from '@openmemorykit/ui/contract'
import { ENABLED_TOGGLE, IDENTIFIER_TEXT, ROLE_CYCLE, type ItemOf } from '../../fixtures/items'
import { boundedText, isFieldItem, sentValue, validateField } from '../../../src/page/domain/form-rules'

const DEFAULT_MAX = 64
const PAIR_MIN = 2
const OVER_PAIR_MIN = 3
const textWith = (rules: readonly Rule[], maxLength = DEFAULT_MAX): ItemOf<typeof ItemKind.Text> => ({ ...IDENTIFIER_TEXT, maxLength, rules })
const FACE = '\u{1F600}'

describe('isFieldItem', () => {
  it('accepts only cycle, toggle and text items', () => {
    expect(isFieldItem(IDENTIFIER_TEXT)).toBe(true)
    expect(isFieldItem(ROLE_CYCLE)).toBe(true)
    expect(isFieldItem(ENABLED_TOGGLE)).toBe(true)
    expect(isFieldItem({ kind: ItemKind.Section, id: 'part', label: 'Part' })).toBe(false)
    expect(isFieldItem({ kind: ItemKind.Info, id: 'info', label: 'Info', value: '1' })).toBe(false)
  })
})

describe('validateField', () => {
  it('refuses a blank value with the required rule and keeps its message', () => {
    const item = textWith([{ kind: RuleKind.Required, message: 'Needed' }])
    expect(validateField(item, '')).toEqual({ rule: RuleKind.Required, format: null, message: 'Needed' })
    expect(validateField(item, '   ')?.rule).toBe(RuleKind.Required)
    expect(validateField(item, ' a ')).toBeNull()
  })

  it('reports required before other rules on an empty value', () => {
    const item = textWith([{ kind: RuleKind.MinLength, min: 3 }, { kind: RuleKind.Required }])
    expect(validateField(item, '')?.rule).toBe(RuleKind.Required)
  })

  it('skips every other rule on an empty optional value', () => {
    const item = textWith([{ kind: RuleKind.MinLength, min: 3 }, { kind: RuleKind.Format, format: TextFormat.Digits }])
    expect(validateField(item, '')).toBeNull()
    expect(validateField(item, '  ')).toBeNull()
  })

  it('refuses a value shorter than the minimum and accepts the boundary', () => {
    const item = textWith([{ kind: RuleKind.MinLength, min: 3 }])
    expect(validateField(item, 'ab')).toEqual({ rule: RuleKind.MinLength, format: null, message: null })
    expect(validateField(item, 'abc')).toBeNull()
  })

  it('counts the minimum length in UTF-16 units', () => {
    const item = textWith([{ kind: RuleKind.MinLength, min: 2 }])
    expect(validateField(item, FACE)).toBeNull()
    expect(validateField(textWith([{ kind: RuleKind.MinLength, min: OVER_PAIR_MIN }]), FACE)?.rule).toBe(RuleKind.MinLength)
  })

  it('refuses a value outside the format and names the format', () => {
    const item = textWith([{ kind: RuleKind.Format, format: TextFormat.Digits, message: 'Digits' }])
    expect(validateField(item, '12a')).toEqual({ rule: RuleKind.Format, format: TextFormat.Digits, message: 'Digits' })
    expect(validateField(item, '123')).toBeNull()
    expect(validateField(textWith([{ kind: RuleKind.Format, format: TextFormat.PlayerIdentifier }]), 'License:abc')?.format).toBe(
      TextFormat.PlayerIdentifier,
    )
  })

  it('reports the first failing rule only', () => {
    const item = textWith([{ kind: RuleKind.MinLength, min: 5 }, { kind: RuleKind.Format, format: TextFormat.Digits }])
    expect(validateField(item, 'ab')?.rule).toBe(RuleKind.MinLength)
  })

  it('never refuses cycle or toggle fields and tolerates a non-text value on a text field', () => {
    expect(validateField(ROLE_CYCLE, 'member')).toBeNull()
    expect(validateField(ENABLED_TOGGLE, false)).toBeNull()
    expect(validateField(IDENTIFIER_TEXT, true)?.rule).toBe(RuleKind.Required)
  })
})

describe('boundedText and sentValue', () => {
  it('cuts a text to the field maximum without splitting a surrogate pair', () => {
    expect(boundedText(textWith([], OVER_PAIR_MIN), 'abcdef')).toBe('abc')
    expect(boundedText(textWith([], PAIR_MIN), `a${FACE}`)).toBe('a')
    expect(boundedText(textWith([], OVER_PAIR_MIN), `a${FACE}`)).toBe(`a${FACE}`)
  })

  it('normalizes a formatted value only after the format matched', () => {
    const item = textWith([{ kind: RuleKind.Format, format: TextFormat.PlayerIdentifier }])
    expect(sentValue(item, 'license:ABC')).toBe('license:abc')
    expect(sentValue(item, 'License:ABC')).toBe('License:ABC')
  })

  it('sends cycle and toggle values unchanged and an empty optional value as is', () => {
    expect(sentValue(ROLE_CYCLE, 'staff')).toBe('staff')
    expect(sentValue(ENABLED_TOGGLE, true)).toBe(true)
    expect(sentValue(textWith([{ kind: RuleKind.Format, format: TextFormat.Hex }]), '')).toBe('')
  })
})
