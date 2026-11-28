import { flushExpiredSnapshots, printIgnoredReports } from './receive-report'
import type { ServerContext } from './server-context'
import { prefixBlock } from './server-log'

export function playerDropped(context: ServerContext, source: number): void {
  flushExpiredSnapshots(context)
  printIgnoredReports(context, context.ports.clock.now())
  context.intake.forget(source)
  context.traces.forget(source)
  const pending = context.snapshots.take(source)
  if (pending === null) return
  prefixBlock([context.log.translate('log.debug.noReply', { player: source })]).forEach(pending.reply)
}
