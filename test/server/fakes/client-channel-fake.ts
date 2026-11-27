import type { ClientChannel } from '../../../src/server/application/ports'
import type { ServerToClientCommand } from '../../../src/shared/net/net-events'

export interface SentCommand {
  readonly target: number
  readonly command: ServerToClientCommand
}

export interface ClientChannelFake extends ClientChannel {
  readonly sent: readonly SentCommand[]
  sentTo(target: number): readonly ServerToClientCommand[]
}

export function createClientChannelFake(): ClientChannelFake {
  const sent: SentCommand[] = []
  return {
    send(target, command) {
      sent.push({ target, command })
    },
    sentTo: (target) => sent.filter((entry) => entry.target === target).map((entry) => entry.command),
    sent,
  }
}
