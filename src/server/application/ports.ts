import type { ConvarSource } from '@openmemorykit/core/shared'
import type { CallResult } from '@openmemorykit/ui/contract'
import type { ServerToClientCommand } from '../../shared/net/net-events'
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

export interface ServerKit {
  command(subcommand: OmkSubcommand, args: readonly string[], reply: (line: string) => void): void
  report(source: number, raw: unknown): void
  playerDropped(source: number): void
  notifyExport(target: number, notification: unknown, caller: string | null): CallResult
  started(): void
}
