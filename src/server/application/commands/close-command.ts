import { CommandKind } from '../../../shared/net/net-events'
import { OmkSubcommand } from '../omk-subcommand'
import { resolvePlayer, usageLines, type SubcommandHandler } from './command-arguments'

export const closeCommand: SubcommandHandler = (context, args) => {
  if (args.length !== 1) return usageLines(context, OmkSubcommand.Close)
  const target = resolvePlayer(context, OmkSubcommand.Close, args[0])
  if (target.player === undefined) return target.refusal
  context.ports.clients.send(target.player, { kind: CommandKind.Close })
  return [context.log.translate('log.command.close', { player: target.player })]
}
