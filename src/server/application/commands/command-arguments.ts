import { NotificationTone } from '@openmemorykit/ui/contract'
import { DemoName, INTENT_COUNT_MAX, INTENT_COUNT_MIN } from '../../../shared/net/net-events'
import type { OmkSubcommand } from '../omk-subcommand'
import type { ServerContext } from '../server-context'
import type { LogKey } from '../server-log'

export type SubcommandHandler = (context: ServerContext, args: readonly string[], reply: (line: string) => void) => readonly string[]

export type PlayerResolution =
  | { readonly player: number; readonly refusal?: undefined }
  | { readonly player?: undefined; readonly refusal: readonly string[] }

const PLAYER_ID_PATTERN = /^\d{1,9}$/
const LIST_SEPARATOR = ', '
const UNKNOWN_NAME_MAX_LENGTH = 64

export function usageLines(context: ServerContext, subcommand: OmkSubcommand): readonly string[] {
  const key: LogKey = `log.usage.${subcommand}`
  return [
    context.log.translate(key, {
      demos: Object.values(DemoName).join(LIST_SEPARATOR),
      tones: Object.values(NotificationTone).join(LIST_SEPARATOR),
      min: INTENT_COUNT_MIN,
      max: INTENT_COUNT_MAX,
    }),
  ]
}

export function isPlayerId(raw: string | undefined): raw is string {
  return raw !== undefined && PLAYER_ID_PATTERN.test(raw)
}

export function unknownPlayerLines(context: ServerContext, raw: string): readonly string[] {
  return [context.log.translate('log.command.unknownPlayer', { player: raw.slice(0, UNKNOWN_NAME_MAX_LENGTH) })]
}

export function resolvePlayer(context: ServerContext, subcommand: OmkSubcommand, raw: string | undefined): PlayerResolution {
  if (!isPlayerId(raw)) return { refusal: usageLines(context, subcommand) }
  const player = Number(raw)
  if (!context.ports.players.exists(player)) return { refusal: unknownPlayerLines(context, raw) }
  return { player }
}
