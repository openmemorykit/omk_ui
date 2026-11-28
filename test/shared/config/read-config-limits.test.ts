import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../../src/shared/config/config-schema'
import { ConfigWarningKind, readConfig } from '../../../src/shared/config/read-config'

const BUDGET_MS = 50
const TABLE_BUDGET_MS = 500
const LIST_BUDGET_MS = 300
const UNKNOWN_KEYS_BUDGET_MS = 750
const MAX_WARNINGS = 20
const HUGE = 100_000
const TEN_THOUSAND = 10_000
const LAST_READ = 1
const THEME = 'theme'

function nested(depth: number): unknown {
  let value: unknown = { leaf: 1 }
  for (let level = 0; level < depth; level += 1) value = { next: value }
  return value
}

class SectionReads {
  private reads = 0

  get total(): number {
    return this.reads
  }

  count(): number {
    this.reads += 1
    return this.reads
  }
}

function sectionProxy(reads: SectionReads, failAfter: number): object {
  return new Proxy({ theme: {}, other: 1 }, {
    get(target, key, receiver): unknown {
      if (key === THEME && reads.count() > failAfter) throw new Error('hostile')
      return Reflect.get(target, key, receiver) as unknown
    },
  })
}

describe('readConfig explicit nulls and limits', () => {
  it.each([
    ['input', 'padHoldMs'],
    ['theme', 'accent'],
    ['input', 'cameraSkippedModes'],
    ['trace', 'onStart'],
  ])('warns for a null %s.%s and keeps the default', (section, key) => {
    const reading = readConfig({ [section]: { [key]: null } })
    expect(reading.config).toEqual(DEFAULT_CONFIG)
    expect(reading.warnings).toEqual([{ key: `${section}.${key}`, kind: ConfigWarningKind.Invalid }])
  })

  it('warns for null sections and null unknown keys', () => {
    const reading = readConfig({ theme: null, other: null, input: { extra: null } })
    expect(reading.config).toEqual(DEFAULT_CONFIG)
    expect(reading.warnings).toEqual([
      { key: 'theme', kind: ConfigWarningKind.Invalid },
      { key: 'other', kind: ConfigWarningKind.Unknown },
      { key: 'input.extra', kind: ConfigWarningKind.Unknown },
    ])
  })

  it('names the cause of a depth refusal', () => {
    const reading = readConfig({ unknown: nested(HUGE) })
    expect(reading.warnings).toEqual([{ key: '', kind: ConfigWarningKind.Invalid, detail: 'depth' }])
  })

  it('caps the warnings and flags the truncation', () => {
    const raw = Object.fromEntries(Array.from({ length: TEN_THOUSAND }, (_unused, index) => [`key${index}`, 1]))
    const reading = readConfig(raw)
    expect(reading.warnings).toHaveLength(MAX_WARNINGS + 1)
    expect(reading.warnings.at(-1)).toEqual({ key: '', kind: ConfigWarningKind.Truncated })
    expect(reading.warnings[0]).toEqual({ key: 'key0', kind: ConfigWarningKind.Unknown })
  })

  it('does not truncate exactly at the cap', () => {
    const raw = Object.fromEntries(Array.from({ length: MAX_WARNINGS }, (_unused, index) => [`key${index}`, 1]))
    expect(readConfig(raw).warnings).toHaveLength(MAX_WARNINGS)
  })
})

describe('readConfig worst cases', () => {
  const cases: readonly (readonly [string, number, () => unknown])[] = [
    ['accent of 10000 characters', BUDGET_MS, () => ({ theme: { accent: '#'.padEnd(TEN_THOUSAND, 'a') } })],
    ['logo of 10000 characters', BUDGET_MS, () => ({ theme: { logo: 'a'.repeat(TEN_THOUSAND) + '.png' } })],
    ['100000 modes', LIST_BUDGET_MS, () => ({ input: { cameraSkippedModes: Array.from({ length: HUGE }, () => 0) } })],
    ['100000 modes as a table', TABLE_BUDGET_MS, () => ({ input: { cameraSkippedModes: Object.fromEntries(Array.from({ length: HUGE }, (_unused, index) => [String(index + 1), 0])) } })],
    ['10000 levels under an unknown key', BUDGET_MS, () => ({ unknown: nested(TEN_THOUSAND) })],
    ['100000 levels under an unknown key', BUDGET_MS, () => ({ unknown: nested(HUGE) })],
    ['100000 levels under a known key', BUDGET_MS, () => ({ theme: { accent: nested(HUGE) } })],
    ['100000 levels at the root', BUDGET_MS, () => nested(HUGE)],
    ['100000 unknown keys at the root', UNKNOWN_KEYS_BUDGET_MS, () => Object.fromEntries(Array.from({ length: HUGE }, (_unused, index) => [`key${index}`, 1]))],
  ]

  it.each(cases)('answers defaults without throwing for %s', (_label, budget, build) => {
    const raw = build()
    readConfig(raw)
    const started = Date.now()
    const reading = readConfig(raw)
    expect(Date.now() - started).toBeLessThan(budget)
    expect(reading.config).toEqual(DEFAULT_CONFIG)
    expect(reading.warnings.length).toBeGreaterThan(0)
  })

  it('survives a throwing getter', () => {
    const raw = { get theme(): unknown { throw new Error('boom') } }
    expect(readConfig(raw).config).toEqual(DEFAULT_CONFIG)
  })

  it('answers from its own copy when a section throws on its last read', () => {
    const measured = new SectionReads()
    readConfig(sectionProxy(measured, Number.POSITIVE_INFINITY))
    const reading = readConfig(sectionProxy(new SectionReads(), measured.total - LAST_READ))
    expect(reading.config).toEqual(DEFAULT_CONFIG)
    expect(reading.warnings).toEqual([{ key: 'other', kind: ConfigWarningKind.Unknown }])
  })
})
