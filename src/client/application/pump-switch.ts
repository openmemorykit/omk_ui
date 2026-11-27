import type { ClientPorts } from './ports'
import { isPumpNeeded } from './pump-demand'
import type { SessionStore } from './session-state'

export function startOrStopPump(ports: ClientPorts, store: SessionStore): void {
  if (isPumpNeeded(store.read())) ports.pump.start()
  else ports.pump.stop()
}
