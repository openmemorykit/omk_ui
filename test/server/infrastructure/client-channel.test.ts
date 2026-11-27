import type { RejectedEvent } from '@openmemorykit/core/shared'
import { NotificationTone } from '@openmemorykit/ui/contract'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ALL_CLIENTS } from '../../../src/server/application/ports'
import { CommandKind, DemoName, NetEvent, type ServerToClientCommand } from '../../../src/shared/net/net-events'
import { createClientChannel } from '../../../src/server/infrastructure/client-channel'
import { createKitServerEvents } from '../../../src/server/infrastructure/server-events'
import { installServerEventNatives, type ServerEventNatives } from './server-adapter-natives'

const PLAYER = 2
const TRACE_ON: ServerToClientCommand = { kind: CommandKind.Trace, active: true }
const NOTIFY: ServerToClientCommand = { kind: CommandKind.Notify, notification: { version: 1, tone: NotificationTone.Info, title: 'Bonjour' } }
const DEMO: ServerToClientCommand = { kind: CommandKind.Demo, demo: DemoName.Radial }
const CLOSE: ServerToClientCommand = { kind: CommandKind.Close }

let natives: ServerEventNatives | null = null

function channelWith(implementations: Readonly<Record<string, (...args: never[]) => unknown>> = {}, failures: unknown[][] = []): ReturnType<typeof createClientChannel> {
  natives = installServerEventNatives(implementations)
  const rejected: RejectedEvent[] = []
  return createClientChannel(createKitServerEvents((event) => rejected.push(event)), (operation, failure) => failures.push([operation, failure]))
}

afterEach(() => {
  natives?.recorder.restore()
  natives = null
  vi.unstubAllGlobals()
})

describe('client channel', () => {
  it('sends trace on omk_ui:trace, notify on omk_ui:notify and the other commands on omk_ui:command, the command as payload', () => {
    const channel = channelWith()
    channel.send(PLAYER, TRACE_ON)
    channel.send(PLAYER, NOTIFY)
    channel.send(PLAYER, DEMO)
    channel.send(PLAYER, CLOSE)
    expect(natives?.recorder.callsOf('emitNet')).toStrictEqual([
      [NetEvent.Trace, PLAYER, TRACE_ON],
      [NetEvent.Notify, PLAYER, NOTIFY],
      [NetEvent.Command, PLAYER, DEMO],
      [NetEvent.Command, PLAYER, CLOSE],
    ])
  })

  it('sends to every player with the target -1', () => {
    const channel = channelWith()
    channel.send(ALL_CLIENTS, TRACE_ON)
    expect(natives?.recorder.callsOf('emitNet')).toStrictEqual([[NetEvent.Trace, ALL_CLIENTS, TRACE_ON]])
  })

  it('keeps a failing emitNet inside the channel and reports it', () => {
    const failure = new Error('emitNet failed')
    const failures: unknown[][] = []
    const channel = channelWith({
      emitNet: () => {
        throw failure
      },
    }, failures)
    expect(() => channel.send(PLAYER, CLOSE)).not.toThrow()
    expect(failures).toStrictEqual([[`emitNet ${NetEvent.Command}`, failure]])
  })
})
