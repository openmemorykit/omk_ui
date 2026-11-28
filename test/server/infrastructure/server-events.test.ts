import { afterEach, describe, expect, it, vi } from 'vitest'
import { NetEvent } from '../../../src/shared/net/net-events'
import { createKitServerEvents } from '../../../src/server/infrastructure/server-events'
import { installServerEventNatives, type ServerEventNatives } from './server-adapter-natives'

const PLAYER = 2

let natives: ServerEventNatives | null = null

afterEach(() => {
  natives?.recorder.restore()
  natives = null
})

describe('server events', () => {
  it('refuses to listen to omk_ui:report: the report is read raw, never walked before its admission', () => {
    natives = installServerEventNatives()
    const events = createKitServerEvents()
    const listenToReport = (name: string): void => (events as unknown as Record<'onFromClient', (eventName: string, listener: () => void) => void>).onFromClient(name, vi.fn())
    expect(() => listenToReport(NetEvent.Report)).toThrow(RangeError)
    expect(natives.recorder.callsOf('onNet')).toStrictEqual([])
  })

  it('sends the commands of the server to a player', () => {
    natives = installServerEventNatives()
    const command = { kind: 'close' } as const
    createKitServerEvents().emitToClient(PLAYER, NetEvent.Command, command)
    expect(natives.recorder.callsOf('emitNet')).toStrictEqual([[NetEvent.Command, PLAYER, command]])
  })
})
