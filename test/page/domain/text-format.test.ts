import { describe, expect, it } from 'vitest'
import { TextFormat } from '@openmemorykit/ui/contract'
import { matchesFormat, normalizeFormatted, TEXT_FORMAT_PATTERNS } from '../../../src/page/domain/text-format'

const ACCEPTED: Readonly<Record<TextFormat, readonly string[]>> = {
  [TextFormat.Digits]: ['0612', '0'],
  [TextFormat.Hex]: ['1a2b3c', '1A2B3C', 'f'],
  [TextFormat.Slug]: ['ma-zone_2', 'a', '0-x'],
  [TextFormat.PlayerIdentifier]: ['license:1a2b3c', 'discord:123456789012345678', 'steam:1.a_b-C', 'ab:Z'],
}

const REFUSED_EVERYWHERE = ['', ' ', '<script>alert(1)</script>', '0612\n', '\n0612', '0612 ', '٠١']

const HOSTILE_MARKERS = '<b>~r~^1{{x}}'

const IDENTIFIER_TYPE_MAX = 16
const IDENTIFIER_VALUE_MAX = 64
const PAIR_LENGTH = 2
const SCRIPT_TAG = '<script>'
const MARKER_COUNT = 100_000
const WORST_CASE_LENGTH = 10_000
const WORST_CASE_PASSES = 100
const WORST_CASE_BUDGET_MS = 1
const MEGABYTE = 1_048_576
const MEGABYTE_BUDGET_MS = 250

const WORST_INPUTS: Readonly<Record<TextFormat, readonly string[]>> = {
  [TextFormat.Digits]: ['0'.repeat(WORST_CASE_LENGTH) + 'x', 'x' + '0'.repeat(WORST_CASE_LENGTH)],
  [TextFormat.Hex]: ['a'.repeat(WORST_CASE_LENGTH) + 'g', 'g' + 'a'.repeat(WORST_CASE_LENGTH)],
  [TextFormat.Slug]: ['a'.repeat(WORST_CASE_LENGTH) + '!', '-' + 'a'.repeat(WORST_CASE_LENGTH)],
  [TextFormat.PlayerIdentifier]: [
    'a'.repeat(WORST_CASE_LENGTH) + ':b',
    'a'.repeat(IDENTIFIER_TYPE_MAX) + ':' + 'b'.repeat(WORST_CASE_LENGTH),
    'a'.repeat(IDENTIFIER_TYPE_MAX) + ':' + 'b'.repeat(WORST_CASE_LENGTH) + '!',
    'a:'.repeat(WORST_CASE_LENGTH / PAIR_LENGTH),
  ],
}

const FORMATS = Object.values(TextFormat)

function averageMs(action: () => void): number {
  action()
  const start = performance.now()
  for (let pass = 0; pass < WORST_CASE_PASSES; pass += 1) action()
  return (performance.now() - start) / WORST_CASE_PASSES
}

describe('TEXT_FORMAT_PATTERNS', () => {
  it('has one pattern per format, without flags that change matching', () => {
    expect(Object.keys(TEXT_FORMAT_PATTERNS).sort()).toEqual([...FORMATS].sort())
    FORMATS.forEach((format) => {
      expect(TEXT_FORMAT_PATTERNS[format].flags).toBe('')
    })
  })

  it('keeps the expressions of the spec table', () => {
    expect(TEXT_FORMAT_PATTERNS[TextFormat.Digits].source).toBe('^[0-9]+$')
    expect(TEXT_FORMAT_PATTERNS[TextFormat.Hex].source).toBe('^[0-9a-fA-F]+$')
    expect(TEXT_FORMAT_PATTERNS[TextFormat.Slug].source).toBe('^[a-z0-9][a-z0-9_-]*$')
    expect(TEXT_FORMAT_PATTERNS[TextFormat.PlayerIdentifier].source).toBe('^[a-z0-9]{2,16}:[0-9A-Za-z._-]{1,64}$')
  })
})

describe('matchesFormat', () => {
  FORMATS.forEach((format) => {
    it(`accepts every example of ${format}`, () => {
      ACCEPTED[format].forEach((value) => {
        expect(matchesFormat(format, value)).toBe(true)
      })
    })

    it(`refuses hostile and empty values for ${format}`, () => {
      REFUSED_EVERYWHERE.concat(HOSTILE_MARKERS).forEach((value) => {
        expect(matchesFormat(format, value)).toBe(false)
      })
    })
  })

  it('refuses the listed counter-examples', () => {
    expect(matchesFormat(TextFormat.Digits, '0612a')).toBe(false)
    expect(matchesFormat(TextFormat.Hex, 'xyz')).toBe(false)
    expect(matchesFormat(TextFormat.Slug, '-zone')).toBe(false)
    expect(matchesFormat(TextFormat.Slug, 'Zone')).toBe(false)
    expect(matchesFormat(TextFormat.PlayerIdentifier, 'license:')).toBe(false)
    expect(matchesFormat(TextFormat.PlayerIdentifier, 'License:abc')).toBe(false)
    expect(matchesFormat(TextFormat.PlayerIdentifier, 'a:b')).toBe(false)
    expect(matchesFormat(TextFormat.PlayerIdentifier, `ab:${'c'.repeat(IDENTIFIER_VALUE_MAX + 1)}`)).toBe(false)
    expect(matchesFormat(TextFormat.PlayerIdentifier, `${'a'.repeat(IDENTIFIER_TYPE_MAX + 1)}:b`)).toBe(false)
  })

  it('does not keep state between calls', () => {
    FORMATS.forEach((format) => {
      const value = ACCEPTED[format][0] ?? ''
      expect([matchesFormat(format, value), matchesFormat(format, value), matchesFormat(format, value)]).toEqual([true, true, true])
    })
  })
})

describe('normalizeFormatted', () => {
  it('lowercases Hex and PlayerIdentifier', () => {
    expect(normalizeFormatted(TextFormat.Hex, '1A2B3c')).toBe('1a2b3c')
    expect(normalizeFormatted(TextFormat.PlayerIdentifier, 'license:ABC')).toBe('license:abc')
    expect(normalizeFormatted(TextFormat.PlayerIdentifier, 'steam:1.A_b-C')).toBe('steam:1.a_b-c')
  })

  it('leaves Slug and Digits unchanged', () => {
    expect(normalizeFormatted(TextFormat.Slug, 'ma-zone_2')).toBe('ma-zone_2')
    expect(normalizeFormatted(TextFormat.Digits, '0612')).toBe('0612')
  })

  it('returns a string for every format and never throws on hostile text', () => {
    FORMATS.forEach((format) => {
      HOSTILE_MARKERS.split('').concat('<script>', '').forEach((value) => {
        expect(typeof normalizeFormatted(format, value)).toBe('string')
      })
    })
  })
})

describe('worst cases', () => {
  FORMATS.forEach((format) => {
    it(`refuses a 10 000 character input in under 1 ms for ${format}`, () => {
      WORST_INPUTS[format].forEach((value) => {
        expect(matchesFormat(format, value)).toBe(false)
        expect(averageMs(() => matchesFormat(format, value))).toBeLessThan(WORST_CASE_BUDGET_MS)
      })
    })

    it(`refuses 1 MB of hostile text for ${format}`, () => {
      const value = SCRIPT_TAG.repeat(MEGABYTE / SCRIPT_TAG.length)
      const start = performance.now()
      expect(matchesFormat(format, value)).toBe(false)
      expect(performance.now() - start).toBeLessThan(MEGABYTE_BUDGET_MS)
    })

    it(`refuses 100 000 color markers for ${format}`, () => {
      const value = '~r~'.repeat(MARKER_COUNT) + '^1'.repeat(MARKER_COUNT)
      const start = performance.now()
      expect(matchesFormat(format, value)).toBe(false)
      expect(performance.now() - start).toBeLessThan(MEGABYTE_BUDGET_MS)
    })
  })
})
