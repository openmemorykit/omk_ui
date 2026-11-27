import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { sampleReport } from '../../fixtures/reports'
import { readReport, ReportDecision } from '../../../src/server/domain/report-rules'

const TIMESTAMP = 1234
const TRACED = true
const PENDING = true
const MEGABYTE = 1_048_576
const LARGE_VIEW_LENGTH = 5_000_000
const LONG_ARRAY_LENGTH = 5000
const BUDGET_MS = 50

interface BufferFactory {
  readonly alloc: (size: number) => Uint8Array
}

const bufferFactory = (globalThis as { readonly Buffer?: BufferFactory }).Buffer

class Envelope {
  readonly kind = ReportKind.PageError
  readonly at = TIMESTAMP
  readonly data = {}
}

function measure(action: () => void): number {
  action()
  const start = Date.now()
  action()
  return Date.now() - start
}

const nonPlainRoots: readonly (readonly [string, () => unknown])[] = [
  ['a Uint8Array of 1 MB', () => new Uint8Array(MEGABYTE)],
  ['a DataView of 1 MB', () => new DataView(new ArrayBuffer(MEGABYTE))],
  ['a Buffer of 1 MB', () => bufferFactory?.alloc(MEGABYTE) ?? new Uint8Array(MEGABYTE)],
  ['an array', () => [{ kind: ReportKind.PageError, at: TIMESTAMP, data: {} }]],
  ['a long array', () => Array.from({ length: LONG_ARRAY_LENGTH }, () => 0)],
  ['a Map', () => new Map([['kind', ReportKind.PageError]])],
  ['a Date', () => new Date(TIMESTAMP)],
  ['a class instance', () => new Envelope()],
]

describe('report rules: root', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has a Buffer to test in this environment', () => {
    expect(bufferFactory).toBeDefined()
  })

  it.each(nonPlainRoots)('refuses %s at the root as invalid', (_label, build) => {
    expect(readReport(build(), TRACED, PENDING)).toEqual({ decision: ReportDecision.Invalid })
  })

  it.each(nonPlainRoots)('never enumerates %s at the root', (_label, build) => {
    const root = build()
    const keys = vi.spyOn(Object, 'keys')
    const values = vi.spyOn(Object, 'values')
    const entries = vi.spyOn(Object, 'entries')
    readReport(root, TRACED, PENDING)
    const enumerated = [...keys.mock.calls, ...values.mock.calls, ...entries.mock.calls].some(([target]) => target === root)
    expect(enumerated).toBe(false)
  })

  it('accepts a null-prototype root', () => {
    const root: Record<string, unknown> = Object.assign(Object.create(null) as Record<string, unknown>, sampleReport(ReportKind.PageError))
    expect(readReport(root, TRACED, PENDING).decision).toBe(ReportDecision.Accepted)
  })

  it('refuses a large typed view at the root quickly', () => {
    const view = new Uint8Array(LARGE_VIEW_LENGTH)
    let decision: string = ReportDecision.Accepted
    expect(measure(() => { decision = readReport(view, TRACED, PENDING).decision })).toBeLessThan(BUDGET_MS)
    expect(decision).toBe(ReportDecision.Invalid)
  })
})

describe('report rules: hostile objects', () => {
  it('refuses a root whose keys cannot be listed, without throwing', () => {
    const root = new Proxy({ ...sampleReport(ReportKind.PageError) }, { ownKeys: () => { throw new Error('hostile') } })
    expect(readReport(root, TRACED, PENDING)).toEqual({ decision: ReportDecision.Invalid })
  })

  it('refuses a root whose kind cannot be read, without throwing', () => {
    const root = Object.defineProperty({ at: TIMESTAMP, data: sampleReport(ReportKind.PageError).data }, 'kind', { enumerable: true, get: () => { throw new Error('hostile') } })
    expect(readReport(root, TRACED, PENDING)).toEqual({ decision: ReportDecision.Invalid })
  })

  it('refuses a root whose prototype cannot be read, without throwing', () => {
    const root = new Proxy({ ...sampleReport(ReportKind.PageError) }, { getPrototypeOf: () => { throw new Error('hostile') } })
    expect(readReport(root, TRACED, PENDING)).toEqual({ decision: ReportDecision.Invalid })
  })
})
