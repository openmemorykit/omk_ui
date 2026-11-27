import { OmkSubcommand } from '../omk-subcommand'
import { flushExpiredSnapshots } from '../receive-report'
import type { ServerContext } from '../server-context'
import { prefixBlock } from '../server-log'
import { askCommand } from './ask-command'
import type { SubcommandHandler } from './command-arguments'
import { closeCommand } from './close-command'
import { configCommand } from './config-command'
import { debugCommand } from './debug-command'
import { demoCommand } from './demo-command'
import { intentCommand } from './intent-command'
import { notifyCommand } from './notify-command'
import { ownersCommand } from './owners-command'
import { traceCommand } from './trace-command'
import { versionCommand } from './version-command'

const HANDLERS: Readonly<Record<OmkSubcommand, SubcommandHandler>> = {
  [OmkSubcommand.Version]: versionCommand,
  [OmkSubcommand.Config]: configCommand,
  [OmkSubcommand.Trace]: traceCommand,
  [OmkSubcommand.Debug]: debugCommand,
  [OmkSubcommand.Owners]: ownersCommand,
  [OmkSubcommand.Demo]: demoCommand,
  [OmkSubcommand.Intent]: intentCommand,
  [OmkSubcommand.Notify]: notifyCommand,
  [OmkSubcommand.Close]: closeCommand,
  [OmkSubcommand.Ask]: askCommand,
}
const SUBCOMMANDS = new Set<string>(Object.values(OmkSubcommand))
const SUBCOMMAND_SEPARATOR = ', '
const UNKNOWN_NAME_MAX_LENGTH = 64

export function parseSubcommand(name: string): OmkSubcommand | null {
  return SUBCOMMANDS.has(name) ? (name as OmkSubcommand) : null
}

export function unknownSubcommandLines(context: ServerContext, name: string): readonly string[] {
  return prefixBlock([
    context.log.translate('log.command.unknown', {
      name: name.slice(0, UNKNOWN_NAME_MAX_LENGTH),
      subcommands: Object.values(OmkSubcommand).join(SUBCOMMAND_SEPARATOR),
    }),
  ])
}

export function runSubcommand(context: ServerContext, subcommand: OmkSubcommand, args: readonly string[], reply: (line: string) => void): void {
  flushExpiredSnapshots(context)
  prefixBlock(HANDLERS[subcommand](context, args, reply)).forEach(reply)
}
