import type { ConvarSource } from '@openmemorykit/core/shared'
import type { CallResult } from '@openmemorykit/ui/contract'
import type { ServerToClientCommand } from '../../shared/net/net-events'
import type { LocaleWarning } from '../../shared/locales/locale-warning'
import type { Clock, ConfigSource, LocaleSource } from '../../shared/ports'
import type { OmkSubcommand } from './omk-subcommand'

export const ALL_CLIENTS = -1

export interface ServerConsole { line(text: string): void }

export interface ClientChannel { send(target: number, command: ServerToClientCommand): void }

export interface PlayerPort {
  exists(source: number): boolean
  list(): readonly number[]
}

export interface ServerPorts {
  readonly console: ServerConsole
  readonly clients: ClientChannel
  readonly players: PlayerPort
  readonly clock: Clock
  readonly convars: ConvarSource
  readonly config: ConfigSource
  readonly locales: LocaleSource
}

export type CommandReply = (line: string) => void

export interface ServerKit {
  command(subcommand: OmkSubcommand, args: readonly string[], reply: CommandReply): void
  unknownSubcommand(name: string, reply: CommandReply): void
  denied(source: number, reply: CommandReply): void
  flushExpired(): void
  localeWarning(warning: LocaleWarning): void
  report(source: number, raw: unknown): void
  playerDropped(source: number): void
  notifyExport(target: number, notification: unknown, caller: string | null): CallResult
  started(): void
}
