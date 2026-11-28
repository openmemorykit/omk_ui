import { describe, expect, it } from 'vitest'
import { formatReportDetails } from '../../../src/server/application/report-details'
import { UNKNOWN_VALUE } from '../../../src/server/application/server-log'

describe('report details', () => {
  it('writes each entry as key=value, text as it is and the rest as JSON', () => {
    expect(formatReportDetails({ mode: 'radial', count: 3, flags: [true] })).toBe('mode=radial, count=3, flags=[true]')
  })

  it('writes an unknown mark for a value that JSON cannot represent', () => {
    expect(formatReportDetails({ missing: undefined, callable: () => 1 })).toBe(`missing=${UNKNOWN_VALUE}, callable=${UNKNOWN_VALUE}`)
  })

  it('neutralises colour codes in keys and values', () => {
    expect(formatReportDetails({ '^1key': '^2value' })).toBe('^ 1key=^ 2value')
  })
})
