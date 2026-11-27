import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { createSerializationFake, EmptyTableShape } from '@openmemorykit/core/testing'
import { ReportEnvelopeSchema, safeParseReportEnvelope } from '../../../src/shared/report/report-envelope'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { PAYLOAD_SAMPLES, REPORT_AT, sampleReport } from '../../fixtures/reports'

const FRACTION = 1.5
const VIEW_LENGTH = 5_000_000
const DEPTH = 100_000
const WIDE_LENGTH = 100_000
const BUDGET_MS = 150
const UNKNOWN_KIND = 'madeUp'

const PAGE_ERROR = sampleReport(ReportKind.PageError)
const SNAPSHOT_DATA = PAYLOAD_SAMPLES[ReportKind.Snapshot]

function snapshotWithClient(client: unknown): unknown {
  return { kind: ReportKind.Snapshot, at: REPORT_AT, data: { ...SNAPSHOT_DATA, client } }
}

describe('report envelope: root', () => {
  it('refuses an unknown kind', () => {
    expect(v.safeParse(ReportEnvelopeSchema, { ...PAGE_ERROR, kind: UNKNOWN_KIND }).success).toBe(false)
  })

  it('refuses an extra key', () => {
    expect(v.safeParse(ReportEnvelopeSchema, { ...PAGE_ERROR, extra: 1 }).success).toBe(false)
  })

  it.each(['toString', 'constructor', 'valueOf'])('refuses an own %s key that the prototype also names', (key) => {
    expect(v.safeParse(ReportEnvelopeSchema, { ...PAGE_ERROR, [key]: 1 }).success).toBe(false)
  })

  it.each([-1, FRACTION, Number.NaN, Number.POSITIVE_INFINITY, '1'])('refuses the timestamp %s', (at) => {
    expect(v.safeParse(ReportEnvelopeSchema, { ...PAGE_ERROR, at }).success).toBe(false)
  })

  it('accepts a timestamp of 0', () => {
    expect(v.safeParse(ReportEnvelopeSchema, { ...PAGE_ERROR, at: 0 }).success).toBe(true)
  })

  it('refuses a data of the wrong type', () => {
    expect(v.safeParse(ReportEnvelopeSchema, { ...PAGE_ERROR, data: 'text' }).success).toBe(false)
    expect(v.safeParse(ReportEnvelopeSchema, { ...PAGE_ERROR, data: [1] }).success).toBe(false)
  })
})

describe('report envelope: serialization', () => {
  it('turns an empty list view into an empty object', () => {
    const parsed = v.parse(ReportEnvelopeSchema, snapshotWithClient([]))
    expect(parsed.kind === ReportKind.Snapshot && parsed.data.client).toEqual({})
  })

  it('accepts an empty view crossing the serialization fake in the list form', () => {
    const crossed = createSerializationFake(EmptyTableShape.List).cross(snapshotWithClient({}))
    expect(v.parse(ReportEnvelopeSchema, crossed)).toEqual(snapshotWithClient({}))
  })

  it('accepts a populated report crossing the serialization fake', () => {
    const report = sampleReport(ReportKind.PanelPainted)
    const crossed = createSerializationFake(EmptyTableShape.Object).cross(report)
    expect(v.parse(ReportEnvelopeSchema, crossed)).toEqual(report)
  })
})

describe('report envelope: hostile data', () => {
  it('refuses a typed view as data or inside data, quickly', () => {
    const view = new Uint8Array(VIEW_LENGTH)
    v.safeParse(ReportEnvelopeSchema, snapshotWithClient({ view }))
    const start = Date.now()
    expect(v.safeParse(ReportEnvelopeSchema, { ...PAGE_ERROR, data: view }).success).toBe(false)
    expect(v.safeParse(ReportEnvelopeSchema, snapshotWithClient(view)).success).toBe(false)
    expect(v.safeParse(ReportEnvelopeSchema, snapshotWithClient({ view })).success).toBe(false)
    expect(Date.now() - start).toBeLessThan(BUDGET_MS)
  })

  it('refuses data nested beyond the depth limit around NaN, quickly', () => {
    let data: unknown = Number.NaN
    for (let level = 0; level < DEPTH; level += 1) data = [data]
    v.safeParse(ReportEnvelopeSchema, snapshotWithClient({ data }))
    const start = Date.now()
    expect(v.safeParse(ReportEnvelopeSchema, snapshotWithClient({ data })).success).toBe(false)
    expect(Date.now() - start).toBeLessThan(BUDGET_MS)
  })

  it('stops at the first issue when parsing through safeParseReportEnvelope', () => {
    const result = safeParseReportEnvelope(snapshotWithClient({ values: Array.from({ length: WIDE_LENGTH }, () => Number.NaN) }))
    expect(result.success).toBe(false)
    expect(result.issues).toHaveLength(1)
  })
})
