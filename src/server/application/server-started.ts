import { checkInstalledArtifact } from './artifact-check'
import { configSummaryLines } from './config-summary'
import { CommandKind } from '../../shared/net/net-events'
import { ALL_CLIENTS } from './ports'
import type { ServerContext } from './server-context'

export function serverStarted(context: ServerContext): void {
  checkInstalledArtifact(context)
  context.log.printBlock(configSummaryLines(context))
  if (!context.ports.config.read().config.trace.onStart) return
  context.traces.activateAll()
  context.ports.clients.send(ALL_CLIENTS, { kind: CommandKind.Trace, active: true })
  context.log.printStamped(context.log.translate('log.trace.onStart'))
}
