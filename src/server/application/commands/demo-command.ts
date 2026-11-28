import { CommandKind, DemoName } from '../../../shared/net/net-events'
import { OmkSubcommand } from '../omk-subcommand'
import { resolvePlayer, usageLines, type SubcommandHandler } from './command-arguments'

const DEMO_NAMES = new Set<string>(Object.values(DemoName))
const ARGUMENT_COUNT = 2

function isDemoName(value: string): value is DemoName {
  return DEMO_NAMES.has(value)
}

export const demoCommand: SubcommandHandler = (context, args) => {
  const [rawPlayer, demo = ''] = args
  if (args.length !== ARGUMENT_COUNT || !isDemoName(demo)) return usageLines(context, OmkSubcommand.Demo)
  const target = resolvePlayer(context, OmkSubcommand.Demo, rawPlayer)
  if (target.player === undefined) return target.refusal
  context.ports.clients.send(target.player, { kind: CommandKind.Demo, demo })
  return [context.log.translate('log.command.demo', { demo, player: target.player })]
}
