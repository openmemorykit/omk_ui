import { describe, expect, it } from 'vitest'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { readReport, ReportDecision } from '../../../src/server/domain/report-rules'

const TIMESTAMP = 1234
const TRACED = true
const IDLE = false
const BIG_NUMBER = 10n

describe('report rules: edges of the envelope', () => {
  it('refuses a plain table that does not claim any kind', () => {
    expect(readReport({ at: TIMESTAMP, data: {} }, TRACED, IDLE)).toEqual({ decision: ReportDecision.Invalid })
  })

  it('refuses a report whose content cannot be serialized', () => {
    const unserializable = { kind: ReportKind.PageError, at: TIMESTAMP, data: { count: BIG_NUMBER } }
    expect(readReport(unserializable, TRACED, IDLE)).toEqual({ decision: ReportDecision.Invalid })
  })
})
