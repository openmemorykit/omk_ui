import { afterEach, describe, expect, it } from 'vitest'
import { startOrStopPump } from '../../../src/client/application/pump-switch'
import { expectKeepInputNeverTurnedOn, storeWith, watchedPorts } from './watched-ports'
import { PUMPING_SESSIONS } from './pumping-sessions'

afterEach(expectKeepInputNeverTurnedOn)

describe('startOrStopPump', () => {
  it.each(PUMPING_SESSIONS)('starts the pump when %s', (_reason, session) => {
    const ports = watchedPorts()
    startOrStopPump(ports, storeWith(session))
    expect(ports.pump.isRunning()).toBe(true)
  })

  it('stops the pump at rest', () => {
    const ports = watchedPorts()
    ports.pump.start()
    startOrStopPump(ports, storeWith())
    expect(ports.pump.isRunning()).toBe(false)
  })
})
