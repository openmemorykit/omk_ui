import { ReportKind } from '../../shared/report/report-kind'
import type { ClientPorts } from './ports'
import type { SessionStore } from './session-state'
import { traceLine } from './trace'

export function traceReleaseGuard(ports: ClientPorts, store: SessionStore, active: boolean, guard: string): void {
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.ReleaseGuard, data: { active, guard } })
}
