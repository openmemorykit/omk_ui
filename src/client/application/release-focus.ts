import type { ValueOf } from '@openmemorykit/core/shared'
import { ReportKind } from '../../shared/report/report-kind'
import type { ClientPorts } from './ports'
import { isPumpNeeded } from './pump-demand'
import type { SessionStore } from './session-state'
import { traceLine } from './trace'

export const FocusReleaseReason = {
  ReturnedToIdle: 'returnedToIdle',
  EscapeReleased: 'escapeReleased',
  PageBlurred: 'pageBlurred',
  EscapeWaitCapped: 'escapeWaitCapped',
  PageUnresponsive: 'pageUnresponsive',
  KitStopping: 'kitStopping',
} as const
export type FocusReleaseReason = ValueOf<typeof FocusReleaseReason>

export function releaseFocus(ports: ClientPorts, store: SessionStore, reason: FocusReleaseReason): void {
  const session = store.read()
  if (session.paused && reason !== FocusReleaseReason.KitStopping) return
  ports.nui.setFocus(false, false)
  ports.nui.setKeepInput(false)
  if (!isPumpNeeded(session)) ports.pump.stop()
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.FocusApplied, data: { focus: false, cursor: false, keepInput: false, reason } })
}
