import { describe, expect, it } from 'vitest'
import { ALL_CLIENTS } from '../../../src/server/application/ports'
import type { ServerPorts } from '../../../src/server/application/ports'
import { CommandKind } from '../../../src/shared/net/net-events'
import { NET_COMMAND_SAMPLES } from '../../fixtures/net-commands'
import { createClientChannelFake } from './client-channel-fake'
import { createPlayerPortFake } from './player-port-fake'
import { createServerConsoleFake } from './server-console-fake'
import { createServerPortsFake } from './server-ports-fake'

const PLAYER = 2
const OTHER_PLAYER = 5
const LINE = '[omk_ui] kit 0.3.0'

describe('ServerConsole fake', () => {
  it('keeps every line', () => {
    const console = createServerConsoleFake()
    console.line(LINE)
    expect(console.lines).toStrictEqual([LINE])
  })
})

describe('ClientChannel fake', () => {
  it('keeps every command with its target, and filters by target', () => {
    const clients = createClientChannelFake()
    clients.send(PLAYER, NET_COMMAND_SAMPLES[CommandKind.Close])
    clients.send(ALL_CLIENTS, NET_COMMAND_SAMPLES[CommandKind.Trace])
    expect(clients.sent.map((entry) => entry.target)).toStrictEqual([PLAYER, ALL_CLIENTS])
    expect(clients.sentTo(PLAYER)).toStrictEqual([NET_COMMAND_SAMPLES[CommandKind.Close]])
    expect(clients.sentTo(ALL_CLIENTS)).toStrictEqual([NET_COMMAND_SAMPLES[CommandKind.Trace]])
  })
})

describe('PlayerPort fake', () => {
  it('knows the players who joined and forgets those who dropped', () => {
    const players = createPlayerPortFake([PLAYER])
    players.join(OTHER_PLAYER)
    expect(players.list()).toStrictEqual([PLAYER, OTHER_PLAYER])
    players.drop(PLAYER)
    expect([players.exists(PLAYER), players.exists(OTHER_PLAYER)]).toStrictEqual([false, true])
  })
})

describe('server ports fake', () => {
  it('gives one fake per port, usable where ServerPorts is expected', () => {
    const ports: ServerPorts = createServerPortsFake([PLAYER])
    expect(Object.keys(ports).sort()).toStrictEqual(['clients', 'clock', 'config', 'console', 'convars', 'locales', 'players'])
    expect(ports.players.exists(PLAYER)).toBe(true)
  })
})
