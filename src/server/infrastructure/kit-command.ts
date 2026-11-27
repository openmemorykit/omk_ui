import { registerAdminCommand, type CommandInvocation } from '@openmemorykit/core/server'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'
import { OmkSubcommand } from '../application/omk-subcommand'

export const KIT_COMMAND_NAME = 'omk_ui'
export const ADMIN_PERMISSION = 'omk_ui.admin'
const NO_SUBCOMMAND = ''

export const KitCommandOperation = { Reply: 'omk_ui reply', Usage: 'omk_ui usage', Denied: 'omk_ui denied' } as const

export type CommandReply = (line: string) => void

export interface KitCommandHandlers {
  readonly run: (subcommand: OmkSubcommand, args: readonly string[], reply: CommandReply) => void
  readonly unknownSubcommand: (name: string, reply: CommandReply) => void
  readonly denied: (source: number, reply: CommandReply) => void
}

type InvocationHandler = (invocation: CommandInvocation) => void
type GuardedUse = (invocation: CommandInvocation, reply: CommandReply) => void

function guardedInvocation(operation: string, use: GuardedUse, onFailure: FailureHandler): InvocationHandler {
  return (invocation) => {
    const reply: CommandReply = (line) => guardedCall(onFailure, KitCommandOperation.Reply, () => invocation.reply(line), undefined)
    guardedCall(onFailure, operation, () => use(invocation, reply), undefined)
  }
}

function subcommandHandlers(handlers: KitCommandHandlers, onFailure: FailureHandler): Readonly<Record<OmkSubcommand, InvocationHandler>> {
  const entries = Object.values(OmkSubcommand).map((subcommand): [OmkSubcommand, InvocationHandler] => [
    subcommand,
    guardedInvocation(`${KIT_COMMAND_NAME} ${subcommand}`, (invocation, reply) => handlers.run(subcommand, invocation.args, reply), onFailure),
  ])
  return Object.fromEntries(entries) as Readonly<Record<OmkSubcommand, InvocationHandler>>
}

export function registerKitCommand(handlers: KitCommandHandlers, onFailure: FailureHandler): void {
  registerAdminCommand({
    name: KIT_COMMAND_NAME,
    permission: ADMIN_PERMISSION,
    subcommands: subcommandHandlers(handlers, onFailure),
    onUsage: guardedInvocation(KitCommandOperation.Usage, (invocation, reply) => handlers.unknownSubcommand(invocation.args[0] ?? NO_SUBCOMMAND, reply), onFailure),
    onDenied: guardedInvocation(KitCommandOperation.Denied, (invocation, reply) => handlers.denied(invocation.source, reply), onFailure),
  })
}
