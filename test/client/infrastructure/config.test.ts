import { createExportsFake, createSerializationFake, EmptyTableShape } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConfigSource } from '../../../src/client/infrastructure/config'
import { DEFAULT_CONFIG } from '../../../src/shared/config/config-schema'
import { ConfigWarningKind } from '../../../src/shared/config/read-config'

const PAD_HOLD_MS = 450
const TOO_DEEP = 17
const failures: unknown[][] = []

afterEach(() => {
  vi.unstubAllGlobals()
  failures.length = 0
})

function setUp(getConfig: (() => unknown) | null): void {
  const fake = createExportsFake(createSerializationFake(EmptyTableShape.Object), 'omk_ui')
  vi.stubGlobal('exports', fake.exports)
  if (getConfig !== null) fake.register('omk_ui', 'getConfig', getConfig)
}

const source = (): ReturnType<typeof createConfigSource> => createConfigSource((operation, cause) => { failures.push([operation, cause]) })

function nested(depth: number): unknown {
  let value: unknown = { leaf: 1 }
  for (let level = 0; level < depth; level += 1) value = { next: value }
  return value
}

describe('createConfigSource', () => {
  it('reads the table of the getConfig export of omk_ui through readConfig', () => {
    setUp(() => ({ input: { padHoldMs: PAD_HOLD_MS }, other: 1 }))
    const reading = source().read()
    expect(reading.config.input.padHoldMs).toBe(PAD_HOLD_MS)
    expect(reading.warnings).toEqual([{ key: 'other', kind: ConfigWarningKind.Unknown }])
  })

  it('gives the defaults for an empty table', () => {
    setUp(() => ({}))
    expect(source().read()).toEqual({ config: DEFAULT_CONFIG, warnings: [] })
  })

  it('gives the defaults with a warning and reports when the export fails', () => {
    setUp(null)
    const reading = source().read()
    expect(reading.config).toEqual(DEFAULT_CONFIG)
    expect(reading.warnings.length).toBeGreaterThan(0)
    expect(failures.map(([operation]) => operation)).toEqual(['exports.omk_ui.getConfig'])
  })

  it('gives the defaults and one root warning, with the reason depth and no path, for a table nested over 16 levels (m3 of task 9, milestone 1)', () => {
    setUp(() => nested(TOO_DEEP))
    expect(source().read()).toEqual({ config: DEFAULT_CONFIG, warnings: [{ key: '', kind: ConfigWarningKind.Invalid, detail: 'depth' }] })
  })
})
