import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { createPlayerPort } from '../../../src/server/infrastructure/player-port'

const PLAYER = 2
const OTHER_PLAYER = 5
const ABSENT_PLAYER = 9
const CONNECTED = [PLAYER, OTHER_PLAYER]
const NOT_AN_INTEGER = 1.5
const CONSOLE = 0
const ALL_CLIENTS = -1

let recorder: NativeRecorder | null = null

function installPlayers(): NativeRecorder {
  recorder = installNatives({
    DoesPlayerExist: (source: string) => CONNECTED.includes(Number(source)),
    GetNumPlayerIndices: () => CONNECTED.length,
    GetPlayerFromIndex: (index: number) => String(CONNECTED[index]),
  })
  return recorder
}

afterEach(() => {
  recorder?.restore()
  recorder = null
})

describe('player port', () => {
  it('asks DoesPlayerExist whether a player source is connected', () => {
    const installed = installPlayers()
    const players = createPlayerPort()
    expect(players.exists(PLAYER)).toBe(true)
    expect(players.exists(ABSENT_PLAYER)).toBe(false)
    expect(installed.callsOf('DoesPlayerExist')).toStrictEqual([[String(PLAYER)], [String(ABSENT_PLAYER)]])
  })

  it('answers no for a source that is not a player, without calling the native', () => {
    const installed = installPlayers()
    const players = createPlayerPort()
    expect([CONSOLE, ALL_CLIENTS, NOT_AN_INTEGER, Number.NaN].map((source) => players.exists(source))).toStrictEqual([false, false, false, false])
    expect(installed.callsOf('DoesPlayerExist')).toStrictEqual([])
  })

  it('lists the connected players', () => {
    installPlayers()
    expect(createPlayerPort().list()).toStrictEqual(CONNECTED)
  })
})
