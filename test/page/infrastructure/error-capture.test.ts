import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FromPage, PAGE_ERROR_STACK_MAX_BYTES, type FromPageMessage } from '../../../src/protocol/from-page'
import { PAGE_ERROR_MESSAGE_MAX_UNITS } from '../../../src/page/application/page-errors'
import { createErrorReporter, installErrorCapture, MAX_CAPTURED_ERRORS } from '../../../src/page/infrastructure/error-capture'
import { trackListeners, type ListenerLedger } from './ledger'

const HUGE = 5000
const FLOOD = 200

function rejection(reason: unknown): Event {
  return Object.assign(new Event('unhandledrejection'), { reason })
}

describe('error capture', () => {
  let reports: FromPageMessage[]
  let ledger: ListenerLedger
  let detach: () => void

  beforeEach(() => {
    reports = []
    ledger = trackListeners(window)
    detach = installErrorCapture(window, (message) => void reports.push(message))
  })
  afterEach(() => {
    detach()
    ledger.restore()
  })

  it('reports an error event once, with its message and stack', () => {
    const error = new Error('broken view')
    window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }))
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({ type: FromPage.PageError, message: 'broken view' })
    expect(reports[0]).toHaveProperty('stack', expect.stringContaining('broken view'))
  })

  it('reports an error event that carries no error object', () => {
    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }))
    expect(reports).toEqual([{ type: FromPage.PageError, message: 'Script error.', stack: '' }])
  })

  it('reports an unhandled rejection once', () => {
    window.dispatchEvent(rejection(new Error('late failure')))
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({ type: FromPage.PageError, message: 'late failure' })
  })

  it('reports a rejection with a non-error reason', () => {
    window.dispatchEvent(rejection('plain text'))
    window.dispatchEvent(rejection(undefined))
    expect(reports).toEqual([
      { type: FromPage.PageError, message: 'plain text', stack: '' },
      { type: FromPage.PageError, message: 'undefined', stack: '' },
    ])
  })

  it('survives a reason that cannot be turned into text', () => {
    const hostile = Object.create(null) as object
    window.dispatchEvent(rejection(hostile))
    expect(reports).toHaveLength(1)
  })

  it('bounds the message, the stack and the number of reports', () => {
    const error = new Error('m'.repeat(HUGE))
    error.stack = 's'.repeat(HUGE)
    window.dispatchEvent(new ErrorEvent('error', { error }))
    const [report] = reports
    expect(report?.type === FromPage.PageError ? report.message.length : Infinity).toBeLessThanOrEqual(PAGE_ERROR_MESSAGE_MAX_UNITS)
    expect(report?.type === FromPage.PageError ? report.stack.length : Infinity).toBeLessThanOrEqual(PAGE_ERROR_STACK_MAX_BYTES)
    for (let count = 0; count < FLOOD; count += 1) window.dispatchEvent(new ErrorEvent('error', { message: 'again' }))
    expect(reports.length).toBeLessThanOrEqual(MAX_CAPTURED_ERRORS)
  })

  it('does not throw back into the page when the report fails', () => {
    detach()
    detach = installErrorCapture(window, () => {
      throw new Error('host down')
    })
    expect(() => window.dispatchEvent(new ErrorEvent('error', { message: 'x' }))).not.toThrow()
  })

  it('removes both listeners on detach', () => {
    detach()
    expect(ledger.active()).toBe(0)
    window.dispatchEvent(new ErrorEvent('error', { message: 'x' }))
    window.dispatchEvent(rejection('y'))
    expect(reports).toEqual([])
  })
})

describe('error reporter', () => {
  it('reports a thrown value as a page error', () => {
    const reports: FromPageMessage[] = []
    createErrorReporter((message) => void reports.push(message))(new Error('render failed'))
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({ type: FromPage.PageError, message: 'render failed' })
  })

  it('stops after the flood limit and never throws', () => {
    const reports: FromPageMessage[] = []
    const report = createErrorReporter((message) => void reports.push(message))
    for (let count = 0; count < FLOOD; count += 1) report(new Error(`failure ${String(count)}`))
    expect(reports).toHaveLength(MAX_CAPTURED_ERRORS)
  })

  it('survives a report function that throws', () => {
    const report = createErrorReporter(() => {
      throw new Error('host down')
    })
    expect(() => report(new Error('render failed'))).not.toThrow()
  })
})
