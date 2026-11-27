import { PLAYER_REPORT_BUCKET } from '../../shared/report/report-bucket'
import { drainTrace, EMPTY_TRACE } from '../domain/trace-buffer'
import type { ClientPorts } from './ports'
import type { SessionStore } from './session-state'

function applyTraceSwitch(ports: ClientPorts, store: SessionStore, active: boolean): void {
  const session = store.read()
  if (session.trace.active === active) return
  if (!active) {
    store.write({ ...session, trace: { ...session.trace, active: false, buffer: EMPTY_TRACE } })
    return
  }
  const drained = drainTrace(session.trace.buffer)
  store.write({ ...session, trace: { ...session.trace, active: true, buffer: drained.buffer } })
  drained.lines.slice(-PLAYER_REPORT_BUCKET.capacity).forEach((line) => ports.server.report(line))
}

export function switchTrace(ports: ClientPorts, store: SessionStore, active: boolean): void {
  try {
    applyTraceSwitch(ports, store, active)
  } catch {
    return
  }
}
