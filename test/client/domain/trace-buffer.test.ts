import { describe, expect, it } from 'vitest'
import { ReportKind } from '../../../src/shared/report/report-kind'
import type { JsonObject } from '../../../src/shared/report/json-value'
import { appendTrace, drainTrace, EMPTY_TRACE, TRACE_CAPACITY, TRACE_LINE_MAX_BYTES, TRACE_MAX_BYTES, type TraceBuffer, type TraceLine } from '../../../src/client/domain/trace-buffer'
import { freeFormTraceLine } from './free-form-trace-line'

const HUNDRED = 100
const SECOND_LINE = 2
const THIRD_LINE = 3
const LATE_LINE = 9
const FIFTH_LINE = 5
const MARGIN = 200
const QUARTER = 4
const HALF = 2
const HUGE_TEXT = 100_000_000
const MANY_STRINGS = 500
const LONG_STRING = 200_000
const HUGE_VIEW = 5_000_000
const HUGE_FLOAT_VIEW = 1_000_000
const HOSTILE_BUDGET_MS = 500
const SMALL_LINES = 60
const TWO_KB = 1900
const DEEP_LEVELS = 100_000

const BIG_LINE_COUNT = 40
const TIME_BUDGET_MS = 2000

function line(at: number, data: JsonObject = { at }, kind: ReportKind = ReportKind.ModeChanged): TraceLine {
  return freeFormTraceLine(at, data, kind)
}

function filled(count: number, make: (index: number) => TraceLine = (index) => line(index, { index })): TraceBuffer {
  return Array.from({ length: count }).reduce<TraceBuffer>((buffer, _unused, index) => appendTrace(buffer, make(index)), EMPTY_TRACE)
}

describe('trace buffer: ring', () => {
  it('keeps 100 lines and drops the oldest on the 101st', () => {
    expect(TRACE_CAPACITY).toBe(HUNDRED)
    const full = filled(TRACE_CAPACITY)
    expect(full.lines).toHaveLength(TRACE_CAPACITY)
    const next = appendTrace(full, line(TRACE_CAPACITY, { index: TRACE_CAPACITY }))
    expect(next.lines).toHaveLength(TRACE_CAPACITY)
    expect(next.lines[0]?.data).toEqual({ index: 1 })
    expect(next.lines[TRACE_CAPACITY - 1]?.data).toEqual({ index: TRACE_CAPACITY })
  })

  it('drains the ring in order and empties it', () => {
    const drained = drainTrace(filled(THIRD_LINE))
    expect(drained.lines.map((entry) => entry.data)).toEqual([{ index: 0 }, { index: 1 }, { index: 2 }])
    expect(drained.buffer).toBe(EMPTY_TRACE)
    expect(drainTrace(drained.buffer).lines).toEqual([])
  })

  it('does not mutate the buffer it was given', () => {
    const before = filled(SECOND_LINE)
    const snapshot = JSON.stringify(before)
    appendTrace(before, line(LATE_LINE, { index: LATE_LINE }))
    drainTrace(before)
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('never writes to the shared empty buffer', () => {
    appendTrace(EMPTY_TRACE, line(1))
    expect(EMPTY_TRACE.lines).toHaveLength(0)
    expect(EMPTY_TRACE.totalBytes).toBe(0)
  })
})

describe('trace buffer: duplicates', () => {
  it('ignores a line identical in kind and data to the last of its kind, whatever its time', () => {
    const first = appendTrace(EMPTY_TRACE, line(1, { mode: 'radial' }))
    expect(appendTrace(first, line(SECOND_LINE, { mode: 'radial' }))).toBe(first)
  })

  it('compares with the last line of the same kind, not the last line', () => {
    const first = appendTrace(EMPTY_TRACE, line(1, { mode: 'radial' }))
    const second = appendTrace(first, line(SECOND_LINE, { page: 'a' }, ReportKind.PageError))
    expect(appendTrace(second, line(THIRD_LINE, { mode: 'radial' }))).toBe(second)
  })

  it('keeps a line that differs by data or by kind, and a return to an earlier value', () => {
    const first = appendTrace(EMPTY_TRACE, line(1, { mode: 'radial' }))
    const changed = appendTrace(first, line(SECOND_LINE, { mode: 'idle' }))
    expect(changed.lines).toHaveLength(SECOND_LINE)
    expect(appendTrace(changed, line(THIRD_LINE, { mode: 'radial' })).lines).toHaveLength(THIRD_LINE)
    expect(appendTrace(first, line(SECOND_LINE, { mode: 'radial' }, ReportKind.PageError)).lines).toHaveLength(SECOND_LINE)
  })
})

describe('trace buffer: byte bound', () => {
  const wide = (index: number): TraceLine => line(index, { index, text: 'x'.repeat(TRACE_LINE_MAX_BYTES - MARGIN) })

  it('stays under the byte limit while the count limit is not reached', () => {
    const buffer = filled(BIG_LINE_COUNT, wide)
    const bytes = JSON.stringify(buffer.lines).length
    expect(buffer.lines.length).toBeLessThan(BIG_LINE_COUNT)
    expect(bytes).toBeLessThanOrEqual(TRACE_MAX_BYTES)
    expect(buffer.totalBytes).toBeLessThanOrEqual(TRACE_MAX_BYTES)
    expect(buffer.lines[buffer.lines.length - 1]?.data).toMatchObject({ index: BIG_LINE_COUNT - 1 })
  })

  it('tracks the byte total through eviction', () => {
    const buffer = filled(BIG_LINE_COUNT, wide)
    const recomputed = buffer.lines.reduce((sum, entry) => sum + JSON.stringify(entry).length, 0)
    expect(buffer.totalBytes).toBe(recomputed)
  })

  it('drops a line above the per-line limit and leaves the buffer as it was', () => {
    const before = filled(SECOND_LINE)
    expect(appendTrace(before, line(FIFTH_LINE, { text: 'x'.repeat(TRACE_LINE_MAX_BYTES) }))).toBe(before)
  })

  it('counts multibyte text in bytes', () => {
    const buffer = appendTrace(EMPTY_TRACE, line(1, { text: '€'.repeat(TRACE_LINE_MAX_BYTES / QUARTER) }))
    expect(buffer.totalBytes).toBeGreaterThan(TRACE_LINE_MAX_BYTES / QUARTER * THIRD_LINE)
    expect(appendTrace(EMPTY_TRACE, line(1, { text: '€'.repeat(TRACE_LINE_MAX_BYTES / HALF) }))).toBe(EMPTY_TRACE)
  })

  it('drops a line whose data is too deep, too wide or cyclic, in bounded time', () => {
    let deep: JsonObject = {}
    for (let level = 0; level < DEEP_LEVELS; level += 1) deep = { deep }
    const wideData = Object.fromEntries(Array.from({ length: DEEP_LEVELS }, (_unused, index) => [`key${String(index)}`, index]))
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const hostile = [deep, wideData, cyclic as JsonObject]
    hostile.forEach((data) => appendTrace(EMPTY_TRACE, line(1, data)))
    const started = Date.now()
    hostile.forEach((data) => {
      expect(appendTrace(EMPTY_TRACE, line(1, data))).toBe(EMPTY_TRACE)
    })
    expect(Date.now() - started).toBeLessThan(TIME_BUDGET_MS)
  })

  it('drops a line whose time is not finite', () => {
    expect(appendTrace(EMPTY_TRACE, line(Number.NaN))).toBe(EMPTY_TRACE)
  })

  it('refuses hostile payloads before serializing them, within the time budget', () => {
    const hugeText = 'x'.repeat(HUGE_TEXT)
    const manyStrings = Array.from({ length: MANY_STRINGS }, () => 'y'.repeat(LONG_STRING))
    const cases: readonly unknown[] = [
      { text: hugeText },
      { [hugeText]: 1 },
      { list: manyStrings },
      new Uint8Array(HUGE_VIEW),
      { view: new Uint8Array(HUGE_VIEW) },
      { nested: [{ view: new Float64Array(HUGE_FLOAT_VIEW) }] },
      { numbers: new Array<number>(HUGE_VIEW).fill(1) },
    ]
    cases.forEach((data) => appendTrace(EMPTY_TRACE, line(1, data as JsonObject)))
    const started = Date.now()
    cases.forEach((data) => {
      expect(appendTrace(EMPTY_TRACE, line(1, data as JsonObject))).toBe(EMPTY_TRACE)
    })
    expect(Date.now() - started).toBeLessThan(HOSTILE_BUDGET_MS)
  })

  it('refuses objects that are not plain, at the root and deeper', () => {
    class Instance { public readonly value = 1 }
    const cases: readonly unknown[] = [new Map([['a', 1]]), new Date(0), new Instance(), { inner: new Map() }, { inner: [new Instance()] }, new Uint8Array(1)]
    cases.forEach((data) => {
      expect(appendTrace(EMPTY_TRACE, line(1, data as JsonObject))).toBe(EMPTY_TRACE)
    })
  })

  it('ignores a line whose data throws when read, instead of raising', () => {
    const throwing = new Proxy({}, { ownKeys: () => { throw new Error('hostile') } })
    const accessor = Object.defineProperty({}, 'value', { enumerable: true, get: () => { throw new Error('hostile') } })
    expect(appendTrace(EMPTY_TRACE, line(1, throwing as JsonObject))).toBe(EMPTY_TRACE)
    expect(appendTrace(EMPTY_TRACE, line(1, accessor as JsonObject))).toBe(EMPTY_TRACE)
  })

  it('keeps a copy: changing the data after the append moves neither the line nor the byte count', () => {
    const data = { text: 'small' }
    const buffer = appendTrace(EMPTY_TRACE, line(1, data))
    data.text = 'z'.repeat(TRACE_LINE_MAX_BYTES * HALF)
    expect(buffer.lines[0]?.data).toEqual({ text: 'small' })
    const evicted = Array.from({ length: BIG_LINE_COUNT }).reduce<TraceBuffer>((current, _unused, index) => appendTrace(current, line(index, { index, text: 'x'.repeat(TRACE_LINE_MAX_BYTES - MARGIN) })), buffer)
    expect(evicted.totalBytes).toBe(evicted.sizes.reduce((sum, size) => sum + size, 0))
    expect(evicted.totalBytes).toBeGreaterThan(0)
  })

  it('freezes the kept line in depth', () => {
    const kept = appendTrace(EMPTY_TRACE, line(1, { inner: { list: [1] } })).lines[0]
    expect(Object.isFrozen(kept?.data)).toBe(true)
    expect(Object.isFrozen(((kept?.data as JsonObject).inner as JsonObject).list)).toBe(true)
  })

  it('holds the byte bound with many small lines then lines of 2000 bytes', () => {
    const small = filled(SMALL_LINES, (index) => line(index, { index }))
    const buffer = Array.from({ length: BIG_LINE_COUNT }).reduce<TraceBuffer>((current, _unused, index) => appendTrace(current, line(index, { index: -index - 1, text: 'x'.repeat(TWO_KB) })), small)
    expect(buffer.totalBytes).toBeLessThanOrEqual(TRACE_MAX_BYTES)
    expect(buffer.lines.reduce((sum, entry) => sum + JSON.stringify(entry).length, 0)).toBeLessThanOrEqual(TRACE_MAX_BYTES)
    expect(buffer.lines.length).toBe(buffer.sizes.length)
  })
})
