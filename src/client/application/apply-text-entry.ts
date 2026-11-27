import { UiMode } from '../../protocol/page-vocabulary'
import { ReportKind } from '../../shared/report/report-kind'
import type { ClientPorts } from './ports'
import type { SessionStore } from './session-state'
import { traceLine } from './trace'

export function applyTextEntry(ports: ClientPorts, store: SessionStore, active: boolean): void {
  const session = store.read()
  const textEntry = active && session.mode !== UiMode.Idle
  if (textEntry === session.textEntry) return
  store.write({ ...session, textEntry })
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.TextEntry, data: { active: textEntry } })
}
