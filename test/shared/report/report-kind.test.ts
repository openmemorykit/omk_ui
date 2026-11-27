import { describe, expect, it } from 'vitest'
import { ReportKind } from '../../../src/shared/report/report-kind'

const MEMBER_COUNT = 25
const CONFIRM_ASKED = 'confirmAsked'
const DEMO_REPLY = 'demoReply'

describe('report kind', () => {
  it('has the 25 members of the vocabulary with distinct values', () => {
    const values = Object.values(ReportKind)
    expect(values).toHaveLength(MEMBER_COUNT)
    expect(new Set(values).size).toBe(MEMBER_COUNT)
  })

  it('carries the answer of an ask, added by D5', () => {
    expect(ReportKind.ConfirmAsked).toBe(CONFIRM_ASKED)
  })

  it('carries the reply to a demo owner, diverted from the exports by D3', () => {
    expect(ReportKind.DemoReply).toBe(DEMO_REPLY)
  })

  it('names each value after its member in camel case', () => {
    for (const [member, value] of Object.entries(ReportKind)) {
      expect(value).toBe(member.charAt(0).toLowerCase() + member.slice(1))
    }
  })
})
