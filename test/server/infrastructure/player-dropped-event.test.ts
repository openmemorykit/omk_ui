import { afterEach, describe, expect, it, vi } from 'vitest'
import { PLAYER_DROPPED_EVENT, registerPlayerDropped } from '../../../src/server/infrastructure/player-dropped-event'
import { installServerEventNatives, type ServerEventNatives } from './server-adapter-natives'

const PLAYER = 6
const LOCAL_TRIGGER = ''
const DROP_REASON = 'Exiting'

let natives: ServerEventNatives | null = null

function installDropped(playerDropped: (source: number) => void, failures: unknown[] = []): ServerEventNatives {
  natives = installServerEventNatives()
  registerPlayerDropped(playerDropped, (error) => failures.push(error))
  return natives
}

afterEach(() => {
  natives?.recorder.restore()
  natives = null
  vi.unstubAllGlobals()
})

describe('player dropped event', () => {
  it('listens to the server event playerDropped, never to the network', () => {
    const installed = installDropped(() => undefined)
    expect(installed.recorder.callsOf('on').map(([name]) => name)).toStrictEqual([PLAYER_DROPPED_EVENT])
    expect(installed.recorder.callsOf('onNet')).toStrictEqual([])
  })

  it('hands the source of the dropped player to the handler', () => {
    const dropped: number[] = []
    const installed = installDropped((source) => dropped.push(source))
    installed.trigger(PLAYER_DROPPED_EVENT, String(PLAYER), DROP_REASON)
    expect(dropped).toStrictEqual([PLAYER])
  })

  it('ignores a playerDropped without a player source (local trigger by another resource)', () => {
    const dropped: number[] = []
    const installed = installDropped((source) => dropped.push(source))
    installed.trigger(PLAYER_DROPPED_EVENT, LOCAL_TRIGGER, DROP_REASON)
    expect(dropped).toStrictEqual([])
  })

  it('keeps a failing handler inside the event handler and reports it', () => {
    const failure = new Error('drop failed')
    const failures: unknown[] = []
    const installed = installDropped(() => {
      throw failure
    }, failures)
    expect(() => installed.trigger(PLAYER_DROPPED_EVENT, PLAYER, DROP_REASON)).not.toThrow()
    expect(failures).toStrictEqual([failure])
  })
})
