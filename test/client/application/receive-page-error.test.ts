import { describe, expect, it } from 'vitest'
import { receivePageError } from '../../../src/client/application/receive-page-error'
import { FromPage, PAGE_ERROR_STACK_MAX_BYTES } from '../../../src/protocol/from-page'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { createReadyHarness, tracedOfKind, withToken } from './use-case-harness'

const ERROR = { message: 'boom', stack: 'at paint (page.js:1:1)' }
const CONSOLE_LINE = '[omk_ui] unreadable page error ignored'

describe('receivePageError', () => {
  it('records the error of the page as a PageError line', () => {
    const harness = createReadyHarness()
    receivePageError(harness.context, withToken(harness, ERROR))
    expect(tracedOfKind(harness, ReportKind.PageError)).toStrictEqual([{ kind: ReportKind.PageError, at: harness.ports.clock.now(), data: ERROR }])
  })

  it.each([
    ['a stack above the byte limit', { ...ERROR, stack: 'x'.repeat(PAGE_ERROR_STACK_MAX_BYTES + 1) }],
    ['a message that is not text', { ...ERROR, message: 42 }],
    ['no stack', { message: 'boom' }],
  ])('refuses %s and says so', (_name, body) => {
    const harness = createReadyHarness()
    receivePageError(harness.context, withToken(harness, body))
    expect(tracedOfKind(harness, ReportKind.PageError)).toStrictEqual([])
    expect(harness.ports.console.printed).toStrictEqual([CONSOLE_LINE])
  })

  it('refuses a body that is not an object and a call without the token', () => {
    const harness = createReadyHarness()
    receivePageError(harness.context, withToken(harness, null as unknown as Record<string, unknown>))
    receivePageError(harness.context, ERROR)
    expect(tracedOfKind(harness, ReportKind.PageError)).toStrictEqual([])
    expect(tracedOfKind(harness, ReportKind.ForgedCall).map((line) => line.data)).toStrictEqual([{ call: FromPage.PageError }])
  })
})
