import { ASK_TEXT_MAX_LENGTH, ASK_TEXT_MIN_LENGTH, CommandKind } from '../../../shared/net/net-events'
import { OmkSubcommand } from '../omk-subcommand'
import { resolvePlayer, usageLines, type SubcommandHandler } from './command-arguments'

const WORD_SEPARATOR = ' '

export const askCommand: SubcommandHandler = (context, args) => {
  const [rawPlayer, ...words] = args
  const text = words.join(WORD_SEPARATOR)
  if (text.length < ASK_TEXT_MIN_LENGTH || text.length > ASK_TEXT_MAX_LENGTH) return usageLines(context, OmkSubcommand.Ask)
  const target = resolvePlayer(context, OmkSubcommand.Ask, rawPlayer)
  if (target.player === undefined) return target.refusal
  if (!context.traces.isActive(target.player)) return [context.log.translate('log.command.askNeedsTrace', { player: target.player })]
  if (context.traces.isEveryoneTraced) context.ports.clients.send(target.player, { kind: CommandKind.Trace, active: true })
  const askId = context.nextAskId()
  context.ports.clients.send(target.player, { kind: CommandKind.Ask, askId, text })
  return [context.log.translate('log.command.ask', { askId, player: target.player })]
}
