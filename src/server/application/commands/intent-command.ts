import { Intent } from '../../../protocol/intents'
import { CommandKind, INTENT_COUNT_MAX, INTENT_COUNT_MIN } from '../../../shared/net/net-events'
import { OmkSubcommand } from '../omk-subcommand'
import { resolvePlayer, usageLines, type SubcommandHandler } from './command-arguments'

const INTENTS = new Set<string>(Object.values(Intent))
const COUNT_PATTERN = /^\d{1,3}$/
const DEFAULT_COUNT = String(INTENT_COUNT_MIN)
const MAX_ARGUMENTS = 3

function isIntent(value: string): value is Intent {
  return INTENTS.has(value)
}

function isInCountRange(count: number): boolean {
  return count >= INTENT_COUNT_MIN && count <= INTENT_COUNT_MAX
}

export const intentCommand: SubcommandHandler = (context, args) => {
  const [rawPlayer, intent = '', rawCount = DEFAULT_COUNT] = args
  const count = COUNT_PATTERN.test(rawCount) ? Number(rawCount) : Number.NaN
  if (args.length > MAX_ARGUMENTS || !isIntent(intent) || !isInCountRange(count)) return usageLines(context, OmkSubcommand.Intent)
  const target = resolvePlayer(context, OmkSubcommand.Intent, rawPlayer)
  if (target.player === undefined) return target.refusal
  context.ports.clients.send(target.player, { kind: CommandKind.Intent, intent, count })
  return [context.log.translate('log.command.intent', { intent, count, player: target.player })]
}
