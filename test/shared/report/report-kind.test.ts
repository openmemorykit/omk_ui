import { describe, expect, it } from 'vitest'
import { ReportKind } from '../../../src/shared/report/report-kind'

const MEMBER_COUNT = 23

describe('report kind', () => {
  it('has the 23 members of the vocabulary with distinct values', () => {
    const values = Object.values(ReportKind)
    expect(values).toHaveLength(MEMBER_COUNT)
    expect(new Set(values).size).toBe(MEMBER_COUNT)
  })

  it('names each value after its member in camel case', () => {
    for (const [member, value] of Object.entries(ReportKind)) {
      expect(value).toBe(member.charAt(0).toLowerCase() + member.slice(1))
    }
  })
})
