import { CallStatus, ContractVersion, NotificationTone } from '@openmemorykit/ui/contract'
import { ALL_CLIENTS } from '../ports'
import { OmkSubcommand } from '../omk-subcommand'
import { relayNotification } from '../server-notify'
import { EVERYBODY, isPlayerId, resolvePlayer, usageLines, type SubcommandHandler } from './command-arguments'

const WORD_SEPARATOR = ' '
const ERROR_SEPARATOR = ', '
const MIN_ARGUMENTS = 3
const TONES = new Set<string>(Object.values(NotificationTone))

function isTone(value: string): value is NotificationTone {
  return TONES.has(value)
}

export const notifyCommand: SubcommandHandler = (context, args) => {
  const [rawTarget = '', tone = '', ...words] = args
  const isEverybody = rawTarget === EVERYBODY
  if (args.length < MIN_ARGUMENTS || !isTone(tone) || (!isEverybody && !isPlayerId(rawTarget))) return usageLines(context, OmkSubcommand.Notify)
  const target = isEverybody ? { player: ALL_CLIENTS } : resolvePlayer(context, OmkSubcommand.Notify, rawTarget)
  if (target.player === undefined) return target.refusal
  const result = relayNotification(context, target.player, { version: ContractVersion.V1, tone, title: words.join(WORD_SEPARATOR) })
  const { translate } = context.log
  if (result.status === CallStatus.Refused) return [translate('log.command.notifyRefused', { errors: result.errors.map((error) => `${error.path} (${error.code})`).join(ERROR_SEPARATOR) })]
  return [translate('log.command.notify', { tone, target: isEverybody ? translate('log.trace.allPlayers') : String(target.player) })]
}
