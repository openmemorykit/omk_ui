import { describe, expect, it } from 'vitest'
import { receivePageTrace } from '../../../src/client/application/receive-page-trace'
import { ONE_LINE_PER_MINUTE_MS } from '../../../src/client/application/trace'
import { FromPage } from '../../../src/protocol/from-page'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { createReadyHarness, tracedOfKind, withToken } from './use-case-harness'

const PAINTED = { panelId: 'whitelist/list', durationMs: 4 }
const TIMEOUT = { owner: 'whitelist', panelId: 'whitelist/add', submissionId: 1 }
const CONSOLE_LINE = '[omk_ui] unreadable page trace ignored'

describe('receivePageTrace', () => {
  it('records a panel painted line with the time of the client, and sends it live when the journal is on', () => {
    const harness = createReadyHarness()
    receivePageTrace(harness.context, withToken(harness, { kind: ReportKind.PanelPainted, data: PAINTED }))
    expect(tracedOfKind(harness, ReportKind.PanelPainted)).toStrictEqual([{ kind: ReportKind.PanelPainted, at: harness.ports.clock.now(), data: PAINTED }])
    expect(harness.ports.server.reports).toStrictEqual([])
    harness.store.write({ ...harness.store.read(), trace: { ...harness.store.read().trace, active: true } })
    receivePageTrace(harness.context, withToken(harness, { kind: ReportKind.FormTimeout, data: TIMEOUT }))
    expect(harness.ports.server.reports).toStrictEqual([{ kind: ReportKind.FormTimeout, at: harness.ports.clock.now(), data: TIMEOUT }])
  })

  it('refuses a kind the page may not trace, even a valid one, and says so once a minute', () => {
    const harness = createReadyHarness()
    const body = withToken(harness, { kind: ReportKind.ModeChanged, data: { from: 'idle', to: 'radial' } })
    receivePageTrace(harness.context, body)
    receivePageTrace(harness.context, body)
    expect(harness.store.read().trace.buffer.lines).toStrictEqual([])
    expect(harness.ports.console.printed).toStrictEqual([CONSOLE_LINE])
    harness.ports.clock.advance(ONE_LINE_PER_MINUTE_MS)
    receivePageTrace(harness.context, body)
    expect(harness.ports.console.printed).toStrictEqual([CONSOLE_LINE, CONSOLE_LINE])
  })

  it.each([
    ['a payload of the wrong shape', { kind: ReportKind.PanelPainted, data: { panelId: 'whitelist/list', durationMs: 'slow' } }],
    ['a payload with an extra key', { kind: ReportKind.PanelPainted, data: { ...PAINTED, extra: true } }],
    ['no payload', { kind: ReportKind.PanelPainted }],
    ['no kind', { data: PAINTED }],
    ['an inherited payload', Object.create({ kind: ReportKind.PanelPainted, data: PAINTED }) as object],
  ])('refuses %s', (_name, body) => {
    const harness = createReadyHarness()
    receivePageTrace(harness.context, withToken(harness, { ...body }))
    expect(harness.store.read().trace.buffer.lines).toStrictEqual([])
    expect(harness.ports.console.printed).toStrictEqual([CONSOLE_LINE])
  })

  it('ignores a body that is not an object, without a token, and logs the forgery', () => {
    const harness = createReadyHarness()
    receivePageTrace(harness.context, null)
    receivePageTrace(harness.context, { kind: ReportKind.PanelPainted, data: PAINTED })
    expect(tracedOfKind(harness, ReportKind.PanelPainted)).toStrictEqual([])
    expect(tracedOfKind(harness, ReportKind.ForgedCall).map((line) => line.data)).toStrictEqual([{ call: FromPage.Trace }])
  })
})
