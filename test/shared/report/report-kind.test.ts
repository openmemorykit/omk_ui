import { describe, expect, it } from 'vitest'
import { ReportKind } from '../../../src/shared/report/report-kind'

const MEMBER_COUNT = 24
const CONFIRM_ASKED = 'confirmAsked'

describe('report kind', () => {
  it('has the 24 members of the vocabulary with distinct values', () => {
    const values = Object.values(ReportKind)
    expect(values).toHaveLength(MEMBER_COUNT)
    expect(new Set(values).size).toBe(MEMBER_COUNT)
  })

  it('carries the answer of an ask, added by D5', () => {
    expect(ReportKind.ConfirmAsked).toBe(CONFIRM_ASKED)
  })

  it('names each value after its member in camel case', () => {
    for (const [member, value] of Object.entries(ReportKind)) {
      expect(value).toBe(member.charAt(0).toLowerCase() + member.slice(1))
    }
  })
})
