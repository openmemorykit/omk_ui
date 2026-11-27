import { runSubcommand, unknownSubcommandLines } from './commands/run-subcommand'
import { createLocaleWarningQueue } from './locale-warnings'
import { playerDropped } from './player-dropped'
import type { ServerKit, ServerPorts } from './ports'
import { flushExpiredSnapshots, receiveReport } from './receive-report'
import { createServerContext } from './server-context'
import { prefixBlock } from './server-log'
import { notifyFromResource } from './server-notify'
import { serverStarted } from './server-started'

export function createServerKit(ports: ServerPorts, version: string): ServerKit {
  const context = createServerContext(ports, version)
  const localeWarnings = createLocaleWarningQueue(context)
  const thenPrintLocaleWarnings = <Result>(result: Result): Result => {
    localeWarnings.printAll()
    return result
  }
  return {
    command: (subcommand, args, reply) => thenPrintLocaleWarnings(runSubcommand(context, subcommand, args, reply)),
    unknownSubcommand: (name, reply) => thenPrintLocaleWarnings(unknownSubcommandLines(context, name).forEach(reply)),
    denied: (_source, reply) => thenPrintLocaleWarnings(prefixBlock([context.log.translate('log.command.denied')]).forEach(reply)),
    report: (source, raw) => thenPrintLocaleWarnings(receiveReport(context, source, raw)),
    playerDropped: (source) => thenPrintLocaleWarnings(playerDropped(context, source)),
    notifyExport: (target, notification, caller) => thenPrintLocaleWarnings(notifyFromResource(context, target, notification, caller)),
    started: () => thenPrintLocaleWarnings(serverStarted(context)),
    flushExpired: () => thenPrintLocaleWarnings(flushExpiredSnapshots(context)),
    localeWarning: (warning) => localeWarnings.add(warning),
  }
}
