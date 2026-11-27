import { CommandKind } from '../../../shared/net/net-events'
import type { OmkSubcommand } from '../omk-subcommand'
import type { ServerContext } from '../server-context'
import type { SnapshotPresenter } from '../snapshot-requests'
import { resolvePlayer, usageLines } from './command-arguments'

export function requestSnapshot(
  context: ServerContext,
  subcommand: OmkSubcommand,
  args: readonly string[],
  reply: (line: string) => void,
  presenterFor: (player: number) => SnapshotPresenter,
): readonly string[] {
  if (args.length !== 1) return usageLines(context, subcommand)
  const target = resolvePlayer(context, subcommand, args[0])
  if (target.player === undefined) return target.refusal
  const requestId = context.snapshots.open(target.player, context.ports.clock.now(), presenterFor(target.player), reply)
  context.ports.clients.send(target.player, { kind: CommandKind.Snapshot, requestId })
  return [context.log.translate('log.command.debug', { player: target.player })]
}
