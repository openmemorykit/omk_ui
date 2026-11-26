import { createSerializationFake, EmptyTableShape } from '@openmemorykit/core/testing'
import { describe, expect, it } from 'vitest'
import { CameraViewMode } from '../../../src/shared/config/camera-view-mode'
import { DEFAULT_CONFIG, PANEL_BACKGROUND } from '../../../src/shared/config/config-schema'
import { contrastRatio } from '../../../src/shared/config/contrast'
import { ConfigWarningKind, readConfig } from '../../../src/shared/config/read-config'

const BUDGET_MS = 50
const TABLE_BUDGET_MS = 500
const LIST_BUDGET_MS = 300
const MAX_WARNINGS = 20
const HUGE = 100_000
const TEN_THOUSAND = 10_000
const MIN_SCALE = 0.9
const MAX_SCALE = 1.1
const MIN_HOLD = 200
const MAX_HOLD = 800
const MAX_SPEED = 200
const NEAR = CameraViewMode.ThirdPersonNear
const MEDIUM = CameraViewMode.ThirdPersonMedium
const FAR = CameraViewMode.ThirdPersonFar
const CINEMATIC = CameraViewMode.Cinematic
const FIRST = CameraViewMode.FirstPerson
const MIN_CONTRAST = 3
const STEP = 0.1
const FRACTION = 1.5
const WIDTH = 2

function nested(depth: number): unknown {
  let value: unknown = { leaf: 1 }
  for (let level = 0; level < depth; level += 1) value = { next: value }
  return value
}

function invalid(section: string, key: string, value: unknown): void {
  const reading = readConfig({ [section]: { [key]: value } })
  expect(reading.config).toEqual(DEFAULT_CONFIG)
  expect(reading.warnings).toEqual([{ key: `${section}.${key}`, kind: ConfigWarningKind.Invalid }])
}

function accepted(section: 'theme' | 'input' | 'trace', key: string, value: unknown): void {
  const reading = readConfig({ [section]: { [key]: value } })
  expect(reading.warnings).toEqual([])
  expect((reading.config[section] as Record<string, unknown>)[key]).toEqual(value)
}

describe('readConfig defaults', () => {
  it('gives the exact defaults for an empty object', () => {
    const reading = readConfig({})
    expect(reading.warnings).toEqual([])
    expect(reading.config).toEqual({
      theme: { accent: '#8F7BFF', side: 'left', scale: 1, font: 'sofiaSansSemiCondensed', logo: null, monogram: 'N' },
      input: { padHoldMs: 300, padHoldGesture: true, vehicleSpeedLimit: 10, cameraSkippedModes: [] },
      trace: { onStart: false },
    })
  })

  it('keeps the default accent readable on the panel', () => {
    expect(contrastRatio(DEFAULT_CONFIG.theme.accent, PANEL_BACKGROUND)).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })

  it('does not mutate its input', () => {
    const raw = { theme: { accent: '#FFFFFF' }, extra: { a: 1 } }
    const copy = JSON.parse(JSON.stringify(raw)) as unknown
    readConfig(raw)
    expect(raw).toEqual(copy)
  })
})

describe('readConfig keys', () => {
  it.each([
    ['theme', 'accent', '#FFFFFF', '#202020'],
    ['theme', 'accent', '#00FF00', 'red'],
    ['theme', 'side', 'right', 'top'],
    ['theme', 'scale', MAX_SCALE, MAX_SCALE + STEP],
    ['theme', 'scale', MIN_SCALE, MIN_SCALE - STEP],
    ['theme', 'font', 'archivoNarrow', 'comic'],
    ['theme', 'logo', 'my-logo_1.webp', '../x.png'],
    ['theme', 'logo', 'a.png', 'a.gif'],
    ['theme', 'monogram', 'AB', 'ABC'],
    ['theme', 'monogram', 'N', ''],
    ['input', 'padHoldMs', MAX_HOLD, MAX_HOLD + 1],
    ['input', 'padHoldMs', MIN_HOLD, MIN_HOLD - 1],
    ['input', 'padHoldMs', MIN_HOLD + 1, MIN_HOLD + FRACTION],
    ['input', 'padHoldGesture', false, 'no'],
    ['input', 'vehicleSpeedLimit', MAX_SPEED, MAX_SPEED + 1],
    ['input', 'vehicleSpeedLimit', 0, -1],
    ['input', 'cameraSkippedModes', [NEAR, MEDIUM, FAR, FIRST], [CINEMATIC]],
    ['input', 'cameraSkippedModes', [FIRST], [NEAR, NEAR]],
    ['input', 'cameraSkippedModes', [], [NEAR, MEDIUM, FAR, FIRST, NEAR]],
    ['trace', 'onStart', true, 'yes'],
  ])('%s.%s accepts %j and refuses %j', (section, key, good, bad) => {
    accepted(section as 'theme', key, good)
    invalid(section, key, bad)
  })

  it('refuses non finite numbers', () => {
    invalid('theme', 'scale', Infinity)
    invalid('input', 'padHoldMs', NaN)
  })

  it('draws the accent limit at a contrast of 3', () => {
    expect(readConfig({ theme: { accent: '#626262' } }).warnings).toEqual([])
    invalid('theme', 'accent', '#616161')
  })

  it('refuses the accent #202020 and accepts #8F7BFF', () => {
    expect(readConfig({ theme: { accent: '#202020' } }).warnings).toHaveLength(1)
    expect(readConfig({ theme: { accent: '#8F7BFF' } }).warnings).toEqual([])
  })

  it('counts the monogram in UTF-16 units', () => {
    accepted('theme', 'monogram', 'é')
    invalid('theme', 'monogram', '\u{1F600}\u{1F600}')
    accepted('theme', 'monogram', '\u{1F600}')
  })

  it('keeps valid keys when a neighbor is invalid', () => {
    const reading = readConfig({ theme: { side: 'right', scale: 5 } })
    expect(reading.config.theme.side).toBe('right')
    expect(reading.config.theme.scale).toBe(1)
    expect(reading.warnings).toEqual([{ key: 'theme.scale', kind: ConfigWarningKind.Invalid }])
  })

  it('treats a null logo as absent', () => {
    const reading = readConfig({ theme: { logo: null } })
    expect(reading.config.theme.logo).toBeNull()
    expect(reading.warnings).toEqual([])
  })
})

describe('readConfig unknown keys', () => {
  it('flags unknown keys at the root and in sections', () => {
    const reading = readConfig({ other: 1, theme: { color: 'red' }, trace: { onStart: true } })
    expect(reading.warnings).toEqual([
      { key: 'other', kind: ConfigWarningKind.Unknown },
      { key: 'theme.color', kind: ConfigWarningKind.Unknown },
    ])
    expect(reading.config.trace.onStart).toBe(true)
  })

  it('flags inherited names as unknown own keys', () => {
    const raw = JSON.parse('{"toString":1,"constructor":2,"__proto__":3,"theme":{"toString":1,"constructor":2,"__proto__":3,"hasOwnProperty":4}}') as unknown
    const reading = readConfig(raw)
    expect(reading.config).toEqual(DEFAULT_CONFIG)
    expect(reading.warnings.map((entry) => entry.key).sort()).toEqual(
      ['__proto__', 'constructor', 'theme.__proto__', 'theme.constructor', 'theme.hasOwnProperty', 'theme.toString', 'toString'].sort(),
    )
    expect(reading.warnings.every((entry) => entry.kind === ConfigWarningKind.Unknown)).toBe(true)
  })

  it('does not pollute prototypes', () => {
    readConfig(JSON.parse('{"__proto__":{"polluted":true},"theme":{"__proto__":{"polluted":true}}}'))
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })
})

describe('readConfig shapes', () => {
  it.each(Object.values(EmptyTableShape))('reads empty Lua tables serialized as %s', (shape) => {
    const fake = createSerializationFake(shape)
    const reading = readConfig(fake.cross({ theme: {}, input: { cameraSkippedModes: [] }, trace: {} }))
    expect(reading.warnings).toEqual([])
    expect(reading.config).toEqual(DEFAULT_CONFIG)
  })

  it('reads an empty list as the whole config and as empty sections', () => {
    expect(readConfig([])).toEqual({ config: DEFAULT_CONFIG, warnings: [] })
    expect(readConfig({ theme: [], input: [], trace: [] })).toEqual({ config: DEFAULT_CONFIG, warnings: [] })
  })

  it('reads a Lua-style list of modes as a table', () => {
    expect(readConfig({ input: { cameraSkippedModes: { 1: NEAR, 2: FIRST } } }).config.input.cameraSkippedModes).toEqual([NEAR, FIRST])
  })

  it.each([['text'], [MIN_CONTRAST], [true], [[NEAR]], [() => NEAR]])('falls back to defaults for a non object root %#', (raw) => {
    const reading = readConfig(raw)
    expect(reading.config).toEqual(DEFAULT_CONFIG)
    expect(reading.warnings).toHaveLength(1)
    expect(reading.warnings[0]?.kind).toBe(ConfigWarningKind.Invalid)
  })

  it('falls back for null and undefined roots', () => {
    expect(readConfig(null).config).toEqual(DEFAULT_CONFIG)
    expect(readConfig(undefined).config).toEqual(DEFAULT_CONFIG)
    expect(readConfig(null).warnings).toHaveLength(1)
  })

  it('refuses a section that is not a table', () => {
    const reading = readConfig({ theme: 'x', input: [1] })
    expect(reading.config).toEqual(DEFAULT_CONFIG)
    expect(reading.warnings).toEqual([
      { key: 'theme', kind: ConfigWarningKind.Invalid },
      { key: 'input', kind: ConfigWarningKind.Invalid },
    ])
  })

  it('refuses a function with a single warning per path', () => {
    const reading = readConfig({ theme: { accent: () => WIDTH }, other: () => WIDTH })
    expect(reading.config).toEqual(DEFAULT_CONFIG)
    expect(reading.warnings.map((entry) => entry.key)).toEqual(['other', 'theme.accent'])
  })
})

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
})
