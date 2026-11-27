import { registerAdminCommand, type CommandInvocation } from '@openmemorykit/core/server'
import { OmkSubcommand } from '../application/omk-subcommand'
import { runGuarded, type FailureHandler } from './guarded-call'

export const KIT_COMMAND_NAME = 'omk_ui'
export const ADMIN_PERMISSION = 'omk_ui.admin'
const NO_SUBCOMMAND = ''

export type CommandReply = (line: string) => void

export interface KitCommandHandlers {
  readonly run: (subcommand: OmkSubcommand, args: readonly string[], reply: CommandReply) => void
  readonly unknownSubcommand: (name: string, reply: CommandReply) => void
  readonly denied: (source: number, reply: CommandReply) => void
}

type InvocationHandler = (invocation: CommandInvocation) => void
type GuardedUse = (invocation: CommandInvocation, reply: CommandReply) => void

function guardedInvocation(use: GuardedUse, onFailure: FailureHandler): InvocationHandler {
  return (invocation) => {
    const reply: CommandReply = (line) => runGuarded(() => invocation.reply(line), onFailure)
    runGuarded(() => use(invocation, reply), onFailure)
  }
}

function subcommandHandlers(handlers: KitCommandHandlers, onFailure: FailureHandler): Readonly<Record<OmkSubcommand, InvocationHandler>> {
  const entries = Object.values(OmkSubcommand).map((subcommand): [OmkSubcommand, InvocationHandler] => [
    subcommand,
    guardedInvocation((invocation, reply) => handlers.run(subcommand, invocation.args, reply), onFailure),
  ])
  return Object.fromEntries(entries) as Readonly<Record<OmkSubcommand, InvocationHandler>>
}

export function registerKitCommand(handlers: KitCommandHandlers, onFailure: FailureHandler): void {
  registerAdminCommand({
    name: KIT_COMMAND_NAME,
    permission: ADMIN_PERMISSION,
    subcommands: subcommandHandlers(handlers, onFailure),
    onUsage: guardedInvocation((invocation, reply) => handlers.unknownSubcommand(invocation.args[0] ?? NO_SUBCOMMAND, reply), onFailure),
    onDenied: guardedInvocation((invocation, reply) => handlers.denied(invocation.source, reply), onFailure),
  })
}
