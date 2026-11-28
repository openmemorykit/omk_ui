import { afterEach, describe, expect, it } from 'vitest'
import { switchTrace } from '../../../src/client/application/switch-trace'
import { PLAYER_REPORT_BUCKET } from '../../../src/shared/report/report-bucket'
import { traceLine } from '../../../src/client/application/trace'
import { TRACE_CAPACITY } from '../../../src/client/domain/trace-buffer'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { expectKeepInputNeverTurnedOn, storeWith, watchedPorts } from './watched-ports'

const FIRST_LINE = { at: 10, kind: ReportKind.ModeChanged, data: { from: UiMode.Idle, to: UiMode.Radial } }
const SECOND_LINE = { at: 20, kind: ReportKind.ModeChanged, data: { from: UiMode.Radial, to: UiMode.Idle } }
const ALTERNATING = 2
const LIVE_LINE = { at: 30, kind: ReportKind.PagePaused, data: { paused: true } }

afterEach(expectKeepInputNeverTurnedOn)

function pausedLine(index: number): typeof LIVE_LINE {
  return { at: index, kind: ReportKind.PagePaused, data: { paused: index % ALTERNATING === 0 } }
}

describe('switchTrace', () => {
  it('sends nothing while the trace is off', () => {
    const ports = watchedPorts()
    const store = storeWith()
    traceLine(ports, store, FIRST_LINE)
    switchTrace(ports, store, false)
    expect(ports.server.reports).toStrictEqual([])
    expect(store.read().trace.active).toBe(false)
  })

  it('drains the ring to the server in order when the trace turns on', () => {
    const ports = watchedPorts()
    const store = storeWith()
    traceLine(ports, store, FIRST_LINE)
    traceLine(ports, store, SECOND_LINE)
    switchTrace(ports, store, true)
    expect(ports.server.reports).toStrictEqual([FIRST_LINE, SECOND_LINE])
    expect(store.read().trace.buffer.lines).toStrictEqual([])
    expect(store.read().trace.active).toBe(true)
  })

  it('sends new lines live once on, and drains nothing twice on a repeated activation', () => {
    const ports = watchedPorts()
    const store = storeWith()
    traceLine(ports, store, FIRST_LINE)
    switchTrace(ports, store, true)
    traceLine(ports, store, LIVE_LINE)
    switchTrace(ports, store, true)
    expect(ports.server.reports).toStrictEqual([FIRST_LINE, LIVE_LINE])
  })

  it('empties the ring when the trace turns off, so a reactivation resends nothing already sent', () => {
    const ports = watchedPorts()
    const store = storeWith()
    switchTrace(ports, store, true)
    traceLine(ports, store, LIVE_LINE)
    switchTrace(ports, store, false)
    traceLine(ports, store, SECOND_LINE)
    switchTrace(ports, store, true)
    expect(ports.server.reports).toStrictEqual([LIVE_LINE, SECOND_LINE])
  })

  it('never lets a failing server channel escape', () => {
    const ports = watchedPorts()
    const store = storeWith()
    traceLine(ports, store, FIRST_LINE)
    const brokenServer = { ...ports, server: { report: (): never => { throw new Error('offline') } } }
    expect(() => switchTrace(brokenServer, store, true)).not.toThrow()
    expect(store.read().trace.active).toBe(true)
  })

  it('sends only the newest lines the server bucket can take at once, in order', () => {
    const ports = watchedPorts()
    const store = storeWith()
    const lines = Array.from({ length: TRACE_CAPACITY }, (_unused, index) => pausedLine(index))
    lines.forEach((line) => traceLine(ports, store, line))
    switchTrace(ports, store, true)
    expect(ports.server.reports).toStrictEqual(lines.slice(-PLAYER_REPORT_BUCKET.capacity))
    expect(store.read().trace.buffer.lines).toStrictEqual([])
  })
})
