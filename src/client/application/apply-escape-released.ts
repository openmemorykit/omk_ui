import { GuardSignal } from '../domain/release-guard'
import { endEscapeWait } from './end-escape-wait'
import type { ClientPorts } from './ports'
import type { SessionStore } from './session-state'

export function applyEscapeReleased(ports: ClientPorts, store: SessionStore): void {
  endEscapeWait(ports, store, GuardSignal.EscapeReleased)
}
