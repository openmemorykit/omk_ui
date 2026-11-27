import { describe, expect, it } from 'vitest'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { appendTrace, EMPTY_TRACE, type TraceLine } from '../../../src/client/domain/trace-buffer'

const TIMESTAMP = 1
const FRACTION = 1.5
const UNKNOWN_KIND = 'madeUp'
const INHERITED_NAME = 'toString'

function lineAt(at: unknown, kind: unknown = ReportKind.ModeChanged): TraceLine {
  return { at, kind, data: {} } as unknown as TraceLine
}

describe('trace buffer: envelope of a line', () => {
  it('keeps a line at time 0', () => {
    expect(appendTrace(EMPTY_TRACE, lineAt(0)).lines).toHaveLength(1)
  })

  it.each([-1, FRACTION, Number.NaN, Number.POSITIVE_INFINITY, String(TIMESTAMP)])('refuses the time %s', (at) => {
    expect(appendTrace(EMPTY_TRACE, lineAt(at))).toBe(EMPTY_TRACE)
  })

  it.each([UNKNOWN_KIND, INHERITED_NAME, '', TIMESTAMP])('refuses the kind %j outside the vocabulary', (kind) => {
    expect(appendTrace(EMPTY_TRACE, lineAt(TIMESTAMP, kind))).toBe(EMPTY_TRACE)
  })

  it.each(Object.values(ReportKind))('keeps the kind %s', (kind) => {
    expect(appendTrace(EMPTY_TRACE, lineAt(TIMESTAMP, kind)).lines).toHaveLength(1)
  })
})
