import { RejectionReason, type RejectedEvent } from '@openmemorykit/core/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { receiveReport } from '../../../src/server/application/receive-report'
import { NetEvent } from '../../../src/shared/net/net-events'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { registerReportEvent } from '../../../src/server/infrastructure/report-event'
import { createKitServerEvents } from '../../../src/server/infrastructure/server-events'
import { sampleReport } from '../../fixtures/reports'
import { createServerHarness, PLAYER } from '../application/server-harness'
import { installServerEventNatives, type ServerEventNatives } from './server-adapter-natives'

const CONSOLE = 0
const LOCAL_TRIGGER = ''
const BURST = 40
const SECOND = 1000
const SHAPE_DEPTH_LIMIT = 16
const UNREADABLE_KIND = { kind: 'bogus', at: 0, data: {} }

interface Received {
  readonly source: number
  readonly raw: unknown
}

let natives: ServerEventNatives | null = null

function installReportEvent(report: (source: number, raw: unknown) => void, failures: unknown[] = []): { readonly rejected: RejectedEvent[]; readonly natives: ServerEventNatives } {
  const installed = installServerEventNatives()
  natives = installed
  const rejected: RejectedEvent[] = []
  registerReportEvent(createKitServerEvents((event) => rejected.push(event)), report, (error) => failures.push(error))
  return { rejected, natives: installed }
}

function nested(depth: number): unknown {
  let value: unknown = {}
  for (let level = 0; level < depth; level += 1) value = { inner: value }
  return value
}

afterEach(() => {
  natives?.recorder.restore()
  natives = null
  vi.unstubAllGlobals()
})

describe('report event omk_ui:report', () => {
  it('listens to omk_ui:report from the network', () => {
    const { natives: installed } = installReportEvent(() => undefined)
    expect(installed.recorder.callsOf('onNet').map(([name]) => name)).toStrictEqual([NetEvent.Report])
  })

  it('hands a player report to the report handler with its raw payload, untouched', () => {
    const received: Received[] = []
    const { natives: installed } = installReportEvent((source, raw) => received.push({ source, raw }))
    const payload = sampleReport(ReportKind.ModeChanged)
    installed.trigger(NetEvent.Report, PLAYER, payload)
    expect(received).toHaveLength(1)
    expect(received[0]?.source).toBe(PLAYER)
    expect(received[0]?.raw).toBe(payload)
  })

  it('refuses a source that is not a player (console, or a local trigger by another resource)', () => {
    const received: Received[] = []
    const { rejected, natives: installed } = installReportEvent((source, raw) => received.push({ source, raw }))
    installed.trigger(NetEvent.Report, LOCAL_TRIGGER, sampleReport(ReportKind.ModeChanged))
    installed.trigger(NetEvent.Report, CONSOLE, sampleReport(ReportKind.ModeChanged))
    expect(received).toStrictEqual([])
    expect(rejected.map((event) => event.reason)).toStrictEqual([RejectionReason.Source, RejectionReason.Source])
  })

  it('refuses a report of a player over his rate without reading its payload', () => {
    const { ports, context } = createServerHarness([PLAYER])
    context.traces.activate(PLAYER)
    const { natives: installed } = installReportEvent((source, raw) => receiveReport(context, source, raw))
    const unreadable = context.log.translate('log.intake.invalid', { player: PLAYER })
    for (let sent = 0; sent < BURST; sent += 1) installed.trigger(NetEvent.Report, PLAYER, sampleReport(ReportKind.ModeChanged))
    installed.trigger(NetEvent.Report, PLAYER, UNREADABLE_KIND)
    expect(ports.console.lines.some((line) => line.includes(unreadable))).toBe(false)
    ports.clock.advance(SECOND)
    installed.trigger(NetEvent.Report, PLAYER, UNREADABLE_KIND)
    expect(ports.console.lines.some((line) => line.includes(unreadable))).toBe(true)
  })

  it('lets core refuse a payload deeper than its shape limits before the report handler', () => {
    const received: Received[] = []
    const { rejected, natives: installed } = installReportEvent((source, raw) => received.push({ source, raw }))
    installed.trigger(NetEvent.Report, PLAYER, nested(SHAPE_DEPTH_LIMIT + 1))
    expect(received).toStrictEqual([])
    expect(rejected.map((event) => event.reason)).toStrictEqual([RejectionReason.Shape])
  })

  it('keeps a failing report handler inside the event handler and reports it', () => {
    const failure = new Error('report failed')
    const failures: unknown[] = []
    const { natives: installed } = installReportEvent(() => {
      throw failure
    }, failures)
    expect(() => installed.trigger(NetEvent.Report, PLAYER, sampleReport(ReportKind.ModeChanged))).not.toThrow()
    expect(failures).toStrictEqual([failure])
  })
})
