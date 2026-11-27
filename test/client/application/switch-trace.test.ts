import { afterEach, describe, expect, it } from 'vitest'
import { switchTrace } from '../../../src/client/application/switch-trace'
import { traceLine } from '../../../src/client/application/trace'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { expectKeepInputNeverTurnedOn, storeWith, watchedPorts } from './watched-ports'

const FIRST_LINE = { at: 10, kind: ReportKind.ModeChanged, data: { from: UiMode.Idle, to: UiMode.Radial } }
const SECOND_LINE = { at: 20, kind: ReportKind.ModeChanged, data: { from: UiMode.Radial, to: UiMode.Idle } }
const LIVE_LINE = { at: 30, kind: ReportKind.PagePaused, data: { paused: true } }

afterEach(expectKeepInputNeverTurnedOn)

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
})
