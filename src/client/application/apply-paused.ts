import { UiMode } from '../../protocol/page-vocabulary'
import { ReportKind } from '../../shared/report/report-kind'
import { GuardKind, GuardSignal } from '../domain/release-guard'
import { endEscapeWait } from './end-escape-wait'
import type { ClientPorts } from './ports'
import type { SessionStore } from './session-state'
import { traceLine } from './trace'

export function applyPaused(ports: ClientPorts, store: SessionStore, paused: boolean): void {
  if (!paused) return
  const session = store.read()
  if (session.guard.kind === GuardKind.Escape) {
    endEscapeWait(ports, store, GuardSignal.PageBlurred)
    return
  }
  if (session.mode === UiMode.Idle || session.paused) return
  store.write({ ...session, paused: true })
  ports.nui.setFocus(false, false)
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.PagePaused, data: { paused: true } })
}
