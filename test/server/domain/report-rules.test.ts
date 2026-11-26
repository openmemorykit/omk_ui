import { describe, expect, it } from 'vitest'
import { serializedByteLength } from '@openmemorykit/core/shared'
import { createSerializationFake, EmptyTableShape } from '@openmemorykit/core/testing'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { readReport, REPORT_MAX_BYTES, REPORT_SHAPE_LIMITS, ReportDecision, SNAPSHOT_MAX_BYTES } from '../../../src/server/domain/report-rules'

const TIMESTAMP = 1234
const TRACED = true
const UNTRACED = false
const PENDING = true
const IDLE = false
const PADDING_CHARACTER = 'x'
const TWO_BYTE_CHARACTER = 'é'
const TWO_BYTES = 2
const TOO_MANY_NODES = 5000
const VIEW_LENGTH = 5_000_000
const WIDE_KEYS = 200_000
const TEN_THOUSAND_LEVELS = 10_000
const HUNDRED_THOUSAND_LEVELS = 100_000
const DEEP_LEVELS = [TEN_THOUSAND_LEVELS, HUNDRED_THOUSAND_LEVELS]
const PLAN_REPORT_MAX_BYTES = 2048
const PLAN_SNAPSHOT_MAX_BYTES = 8192
const PLAN_MAX_DEPTH = 10
const PLAN_MAX_NODES = 4096
const BUDGET_MS = 50
const WIDE_BUDGET_MS = 300

function reportOfBytes(kind: string, bytes: number): unknown {
  const base = serializedByteLength({ kind, at: TIMESTAMP, data: { text: '' } }) ?? 0
  return { kind, at: TIMESTAMP, data: { text: PADDING_CHARACTER.repeat(bytes - base) } }
}

function nested(levels: number, wrap: (inner: unknown) => unknown): unknown {
  let value: unknown = 0
  for (let level = 0; level < levels; level += 1) value = wrap(value)
  return value
}

function measure(action: () => void): number {
  action()
  const start = Date.now()
  action()
  return Date.now() - start
}

const pageError = { kind: ReportKind.PageError, at: TIMESTAMP, data: { message: 'boom' } }
const snapshot = { kind: ReportKind.Snapshot, at: TIMESTAMP, data: { panels: 1 } }

describe('report rules: values', () => {
  it('uses the exact limits of the plan', () => {
    expect(REPORT_MAX_BYTES).toBe(PLAN_REPORT_MAX_BYTES)
    expect(SNAPSHOT_MAX_BYTES).toBe(PLAN_SNAPSHOT_MAX_BYTES)
    expect(REPORT_SHAPE_LIMITS).toEqual({ maxDepth: PLAN_MAX_DEPTH, maxNodes: PLAN_MAX_NODES })
  })
})

describe('report rules: trace', () => {
  it('accepts a report while the trace is active', () => {
    expect(readReport(pageError, TRACED, IDLE)).toEqual({ decision: ReportDecision.Accepted, report: pageError })
  })

  it('refuses a report while the trace is off, even with a pending snapshot', () => {
    expect(readReport(pageError, UNTRACED, IDLE)).toEqual({ decision: ReportDecision.NotTraced })
    expect(readReport(pageError, UNTRACED, PENDING)).toEqual({ decision: ReportDecision.NotTraced })
  })

  it('accepts a snapshot answering a pending request while the trace is off', () => {
    expect(readReport(snapshot, UNTRACED, PENDING)).toEqual({ decision: ReportDecision.Accepted, report: snapshot })
  })

  it('refuses a snapshot nobody asked for, traced or not', () => {
    expect(readReport(snapshot, UNTRACED, IDLE)).toEqual({ decision: ReportDecision.NotTraced })
    expect(readReport(snapshot, TRACED, IDLE)).toEqual({ decision: ReportDecision.NotTraced })
  })

  it('refuses a malformed report while the trace is off without reading it further', () => {
    expect(readReport({ kind: 'madeUp', data: Number.NaN }, UNTRACED, PENDING).decision).toBe(ReportDecision.NotTraced)
  })
})

describe('report rules: size', () => {
  it('accepts 2 048 bytes and refuses 2 049', () => {
    expect(readReport(reportOfBytes(ReportKind.PageError, REPORT_MAX_BYTES), TRACED, IDLE).decision).toBe(ReportDecision.Accepted)
    expect(readReport(reportOfBytes(ReportKind.PageError, REPORT_MAX_BYTES + 1), TRACED, IDLE).decision).toBe(ReportDecision.TooLarge)
  })

  it('accepts a snapshot of 8 192 bytes and refuses 8 193', () => {
    expect(readReport(reportOfBytes(ReportKind.Snapshot, SNAPSHOT_MAX_BYTES), TRACED, PENDING).decision).toBe(ReportDecision.Accepted)
    expect(readReport(reportOfBytes(ReportKind.Snapshot, SNAPSHOT_MAX_BYTES + 1), TRACED, PENDING).decision).toBe(ReportDecision.TooLarge)
  })

  it('keeps the 2 048 bytes limit for every other kind', () => {
    expect(readReport(reportOfBytes(ReportKind.PanelPainted, SNAPSHOT_MAX_BYTES), TRACED, PENDING).decision).toBe(ReportDecision.TooLarge)
  })

  it('counts UTF-8 bytes, not characters', () => {
    const base = serializedByteLength({ kind: ReportKind.PageError, at: TIMESTAMP, data: { text: '' } }) ?? 0
    const characters = Math.ceil((REPORT_MAX_BYTES - base) / TWO_BYTES) + 1
    const report = { kind: ReportKind.PageError, at: TIMESTAMP, data: { text: TWO_BYTE_CHARACTER.repeat(characters) } }
    expect(readReport(report, TRACED, IDLE).decision).toBe(ReportDecision.TooLarge)
  })

  it('refuses more nodes than the shape limit as too large', () => {
    const report = { kind: ReportKind.PageError, at: TIMESTAMP, data: { rows: Array.from({ length: TOO_MANY_NODES }, () => 0) } }
    expect(readReport(report, TRACED, IDLE).decision).toBe(ReportDecision.TooLarge)
  })
})

describe('report rules: envelope', () => {
  it('refuses an unknown kind', () => {
    expect(readReport({ kind: 'madeUp', at: TIMESTAMP, data: {} }, TRACED, IDLE)).toEqual({ decision: ReportDecision.Invalid })
  })

  it.each([null, undefined, 'text', 1, [], [pageError], { kind: ReportKind.PageError, at: TIMESTAMP }])('refuses the value %j', (raw) => {
    expect(readReport(raw, TRACED, IDLE)).toEqual({ decision: ReportDecision.Invalid })
  })

  it('refuses an extra key', () => {
    expect(readReport({ ...pageError, extra: 1 }, TRACED, IDLE).decision).toBe(ReportDecision.Invalid)
  })

  it('accepts an empty data crossing the serialization fake in the list form', () => {
    const crossed = createSerializationFake(EmptyTableShape.List).cross({ kind: ReportKind.PageError, at: TIMESTAMP, data: {} })
    expect(Array.isArray((crossed as { readonly data: unknown }).data)).toBe(true)
    expect(readReport(crossed, TRACED, IDLE)).toEqual({ decision: ReportDecision.Accepted, report: { kind: ReportKind.PageError, at: TIMESTAMP, data: {} } })
  })

  it('refuses an own __proto__ key at the root', () => {
    const raw: unknown = JSON.parse(`{"__proto__":{"polluted":true},"kind":"${ReportKind.PageError}","at":${String(TIMESTAMP)},"data":{}}`)
    expect(readReport(raw, TRACED, IDLE)).toEqual({ decision: ReportDecision.Invalid })
  })

  it.each(['toString', 'constructor', 'hasOwnProperty'])('refuses an own %s key at the root', (key) => {
    const raw: unknown = JSON.parse(`{"${key}":1,"kind":"${ReportKind.PageError}","at":${String(TIMESTAMP)},"data":{}}`)
    expect(readReport(raw, TRACED, IDLE)).toEqual({ decision: ReportDecision.Invalid })
  })

  it('refuses an own __proto__ key inside data', () => {
    const raw: unknown = JSON.parse(`{"kind":"${ReportKind.PageError}","at":${String(TIMESTAMP)},"data":{"__proto__":{"polluted":true}}}`)
    expect(readReport(raw, TRACED, IDLE).decision).toBe(ReportDecision.Invalid)
  })

  it.each(['toString', 'valueOf'])('refuses an own %s key inside data', (key) => {
    const raw: unknown = JSON.parse(`{"kind":"${ReportKind.PageError}","at":${String(TIMESTAMP)},"data":{"${key}":1}}`)
    expect(readReport(raw, TRACED, IDLE).decision).toBe(ReportDecision.Invalid)
  })

  it('returns a copy, not the received object', () => {
    const reading = readReport(pageError, TRACED, IDLE)
    expect(reading.decision === ReportDecision.Accepted && reading.report !== pageError).toBe(true)
  })

  it('refuses a cycle without throwing', () => {
    const data: Record<string, unknown> = {}
    data.self = data
    expect(readReport({ kind: ReportKind.PageError, at: TIMESTAMP, data }, TRACED, IDLE).decision).toBe(ReportDecision.Invalid)
  })
})

describe('report rules: worst cases', () => {
  it.each(DEEP_LEVELS)('refuses %i levels of arrays and objects, inside data and at the root, quickly', (levels) => {
    const inputs = [
      { kind: ReportKind.Snapshot, at: TIMESTAMP, data: { deep: nested(levels, (inner) => [inner]) } },
      { kind: ReportKind.Snapshot, at: TIMESTAMP, data: { deep: nested(levels, (inner) => ({ inner })) } },
      nested(levels, (inner) => ({ kind: ReportKind.Snapshot, inner })),
    ]
    inputs.forEach((raw) => {
      let decision: string = ReportDecision.Accepted
      expect(measure(() => { decision = readReport(raw, TRACED, PENDING).decision })).toBeLessThan(BUDGET_MS)
      expect(decision).toBe(ReportDecision.Invalid)
    })
  })

  it('refuses typed views before measuring their size, quickly', () => {
    const view = new Uint8Array(VIEW_LENGTH)
    const inputs = [
      { kind: ReportKind.Snapshot, at: TIMESTAMP, data: { view } },
      { kind: ReportKind.Snapshot, at: TIMESTAMP, data: { rows: [{ view }] } },
      { kind: ReportKind.Snapshot, at: TIMESTAMP, data: new DataView(view.buffer) },
    ]
    inputs.forEach((raw) => {
      let decision: string = ReportDecision.Accepted
      expect(measure(() => { decision = readReport(raw, TRACED, PENDING).decision })).toBeLessThan(BUDGET_MS)
      expect(decision).toBe(ReportDecision.Invalid)
    })
  })

  it('refuses a very wide object quickly', () => {
    const wide = Object.fromEntries(Array.from({ length: WIDE_KEYS }, (_, index) => [`key${String(index)}`, index]))
    let decision: string = ReportDecision.Accepted
    expect(measure(() => { decision = readReport({ kind: ReportKind.Snapshot, at: TIMESTAMP, data: wide }, TRACED, PENDING).decision })).toBeLessThan(WIDE_BUDGET_MS)
    expect(decision).toBe(ReportDecision.TooLarge)
  })
})
