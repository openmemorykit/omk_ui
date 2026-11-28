import { describe, expect, it } from 'vitest'
import { FocusReleaseReason, releaseFocus } from '../../../src/client/application/release-focus'
import { createSessionStore, INITIAL_CLIENT_SESSION, type ClientSession } from '../../../src/client/application/session-state'
import { safeParseReportEnvelope } from '../../../src/shared/report/report-envelope'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { createClientPortsFake, type ClientPortsFake } from '../fakes/client-ports-fake'
import { PUMPING_SESSIONS } from './pumping-sessions'

const NOW = 4200

function pumpingPorts(): ClientPortsFake {
  const ports = createClientPortsFake(NOW)
  ports.pump.start()
  ports.nui.setKeepInput(true)
  return ports
}

describe('releaseFocus', () => {
  it('gives the focus and the cursor back to the game and turns keepInput off', () => {
    const ports = pumpingPorts()
    releaseFocus(ports, createSessionStore(INITIAL_CLIENT_SESSION), FocusReleaseReason.ReturnedToIdle)
    expect(ports.nui.focusChanges).toStrictEqual([{ focus: false, cursor: false }])
    expect(ports.nui.keepInputChanges.at(-1)).toBe(false)
    expect(ports.nui.isKeepingInput()).toBe(false)
  })

  it('stops the pump when nothing needs it any more', () => {
    const ports = pumpingPorts()
    releaseFocus(ports, createSessionStore(INITIAL_CLIENT_SESSION), FocusReleaseReason.EscapeReleased)
    expect(ports.pump.isRunning()).toBe(false)
  })

  it.each(PUMPING_SESSIONS)('keeps the pump running when %s', (_reason, session) => {
    const ports = pumpingPorts()
    releaseFocus(ports, createSessionStore(session), FocusReleaseReason.EscapeWaitCapped)
    expect(ports.pump.isRunning()).toBe(true)
    expect(ports.nui.focusChanges).toStrictEqual([{ focus: false, cursor: false }])
  })

  it('touches neither the focus, nor keepInput, nor the pump during a pause', () => {
    const ports = pumpingPorts()
    const store = createSessionStore({ ...INITIAL_CLIENT_SESSION, paused: true })
    const before = store.read()
    releaseFocus(ports, store, FocusReleaseReason.PageBlurred)
    expect(ports.nui.focusChanges).toStrictEqual([])
    expect(ports.nui.keepInputChanges).toStrictEqual([true])
    expect(ports.pump.isRunning()).toBe(true)
    expect(store.read()).toBe(before)
  })

  it('gives the focus back even during a pause when the kit stops', () => {
    const ports = pumpingPorts()
    releaseFocus(ports, createSessionStore({ ...INITIAL_CLIENT_SESSION, paused: true }), FocusReleaseReason.KitStopping)
    expect(ports.nui.focusChanges).toStrictEqual([{ focus: false, cursor: false }])
    expect(ports.nui.keepInputChanges.at(-1)).toBe(false)
  })

  it('writes a FocusApplied line with the reason', () => {
    const ports = pumpingPorts()
    const store = createSessionStore(INITIAL_CLIENT_SESSION)
    releaseFocus(ports, store, FocusReleaseReason.PageUnresponsive)
    expect(store.read().trace.buffer.lines).toStrictEqual([
      { at: NOW, kind: ReportKind.FocusApplied, data: { focus: false, cursor: false, keepInput: false, reason: FocusReleaseReason.PageUnresponsive } },
    ])
  })

  it('sends that line to the server while the journal is on', () => {
    const ports = pumpingPorts()
    const session: ClientSession = { ...INITIAL_CLIENT_SESSION, mode: UiMode.Idle, trace: { ...INITIAL_CLIENT_SESSION.trace, active: true } }
    releaseFocus(ports, createSessionStore(session), FocusReleaseReason.KitStopping)
    expect(ports.server.reports.map((report) => report.kind)).toStrictEqual([ReportKind.FocusApplied])
  })

  it.each(Object.values(FocusReleaseReason))('sends a line that the report schema accepts for the reason %s', (reason) => {
    const ports = pumpingPorts()
    const session: ClientSession = { ...INITIAL_CLIENT_SESSION, trace: { ...INITIAL_CLIENT_SESSION.trace, active: true } }
    releaseFocus(ports, createSessionStore(session), reason)
    const [sent] = ports.server.reports
    expect(safeParseReportEnvelope(sent).success).toBe(true)
    expect(sent?.data).toStrictEqual({ focus: false, cursor: false, keepInput: false, reason })
  })

  it('names every reason once, in camelCase', () => {
    const reasons = Object.values(FocusReleaseReason)
    expect(new Set(reasons).size).toBe(reasons.length)
    reasons.forEach((reason) => expect(reason).toMatch(/^[a-z]+([A-Z][a-z]+)*$/))
  })
})
