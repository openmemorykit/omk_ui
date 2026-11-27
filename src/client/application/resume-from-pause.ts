import { ReportKind } from '../../shared/report/report-kind'
import { primePadSnapshot } from '../domain/pad-snapshot'
import { applyFocus, FocusApplyReason } from './apply-focus'
import type { ClientPorts } from './ports'
import { startOrStopPump } from './pump-switch'
import type { SessionStore } from './session-state'
import { traceLine } from './trace'

export function resumeFromPause(ports: ClientPorts, store: SessionStore): void {
  const session = store.read()
  if (!session.paused) return
  store.write({ ...session, paused: false, pad: primePadSnapshot(ports.controls.readPad()) })
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.PagePaused, data: { paused: false } })
  applyFocus(ports, store, FocusApplyReason.Resumed)
  startOrStopPump(ports, store)
}
