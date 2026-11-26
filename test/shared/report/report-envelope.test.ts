import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { createSerializationFake, EmptyTableShape } from '@openmemorykit/core/testing'
import { ReportEnvelopeSchema } from '../../../src/shared/report/report-envelope'
import { ReportKind } from '../../../src/shared/report/report-kind'

const TIMESTAMP = 1234
const FRACTION = 1.5
const VIEW_LENGTH = 5_000_000
const DEPTH = 100_000
const ROW_FIRST = 1
const ROW_SECOND = 2
const ROW_PAIR = [ROW_FIRST, ROW_SECOND]
const PAINT_MILLISECONDS = 4
const BUDGET_MS = 50

describe('report envelope', () => {
  it('accepts every kind of the vocabulary', () => {
    for (const kind of Object.values(ReportKind)) {
      expect(v.safeParse(ReportEnvelopeSchema, { kind, at: TIMESTAMP, data: { ok: true } }).success).toBe(true)
    }
  })

  it('refuses an unknown kind', () => {
    expect(v.safeParse(ReportEnvelopeSchema, { kind: 'madeUp', at: TIMESTAMP, data: {} }).success).toBe(false)
  })

  it('refuses an extra key', () => {
    expect(v.safeParse(ReportEnvelopeSchema, { kind: ReportKind.PageError, at: TIMESTAMP, data: {}, extra: 1 }).success).toBe(false)
  })

  it.each([-1, FRACTION, Number.NaN, Number.POSITIVE_INFINITY, '1'])('refuses the timestamp %s', (at) => {
    expect(v.safeParse(ReportEnvelopeSchema, { kind: ReportKind.PageError, at, data: {} }).success).toBe(false)
  })

  it('accepts a timestamp of 0', () => {
    expect(v.safeParse(ReportEnvelopeSchema, { kind: ReportKind.PageError, at: 0, data: {} }).success).toBe(true)
  })

  it('turns an empty list data into an empty object', () => {
    const parsed = v.parse(ReportEnvelopeSchema, { kind: ReportKind.PageError, at: TIMESTAMP, data: [] })
    expect(parsed.data).toEqual({})
    expect(Array.isArray(parsed.data)).toBe(false)
  })

  it('accepts an empty data crossing the serialization fake in the list form', () => {
    const crossed = createSerializationFake(EmptyTableShape.List).cross({ kind: ReportKind.PageError, at: TIMESTAMP, data: {} })
    expect(Array.isArray((crossed as { data: unknown }).data)).toBe(true)
    expect(v.parse(ReportEnvelopeSchema, crossed)).toEqual({ kind: ReportKind.PageError, at: TIMESTAMP, data: {} })
  })

  it('accepts a populated report crossing the serialization fake', () => {
    const report = { kind: ReportKind.PanelPainted, at: TIMESTAMP, data: { panel: 'list', milliseconds: PAINT_MILLISECONDS, rows: ROW_PAIR } }
    const crossed = createSerializationFake(EmptyTableShape.Object).cross(report)
    expect(v.parse(ReportEnvelopeSchema, crossed)).toEqual(report)
  })

  it('refuses a data of the wrong type', () => {
    expect(v.safeParse(ReportEnvelopeSchema, { kind: ReportKind.PageError, at: TIMESTAMP, data: 'text' }).success).toBe(false)
    expect(v.safeParse(ReportEnvelopeSchema, { kind: ReportKind.PageError, at: TIMESTAMP, data: [1] }).success).toBe(false)
  })

  it('refuses a typed view as data or inside data, quickly', () => {
    const view = new Uint8Array(VIEW_LENGTH)
    const start = Date.now()
    expect(v.safeParse(ReportEnvelopeSchema, { kind: ReportKind.Snapshot, at: TIMESTAMP, data: view }).success).toBe(false)
    expect(v.safeParse(ReportEnvelopeSchema, { kind: ReportKind.Snapshot, at: TIMESTAMP, data: { view } }).success).toBe(false)
    expect(Date.now() - start).toBeLessThan(BUDGET_MS)
  })

  it('refuses data nested beyond the depth limit around NaN, quickly', () => {
    let data: unknown = Number.NaN
    for (let level = 0; level < DEPTH; level += 1) data = [data]
    const start = Date.now()
    expect(v.safeParse(ReportEnvelopeSchema, { kind: ReportKind.Snapshot, at: TIMESTAMP, data: { data } }).success).toBe(false)
    expect(Date.now() - start).toBeLessThan(BUDGET_MS)
  })
})
