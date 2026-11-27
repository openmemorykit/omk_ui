import { describe, expect, it } from 'vitest'
import type { ClientPorts } from '../../../src/client/application/ports'
import { createClientPortsFake } from './client-ports-fake'

const START_AT = 1000
const STEP = 16

describe('client ports fake', () => {
  it('gives one fake per port, usable where ClientPorts is expected', () => {
    const ports: ClientPorts = createClientPortsFake()
    expect(Object.keys(ports).sort()).toStrictEqual(['camera', 'clock', 'config', 'console', 'controls', 'convars', 'events', 'game', 'glyphs', 'idle', 'locales', 'nui', 'pump', 'random', 'replies', 'server'])
  })

  it('keeps the pump and the idle tick apart', () => {
    const ports = createClientPortsFake()
    ports.pump.start()
    expect(ports.idle.isRunning()).toBe(false)
  })

  it('drives its clock by hand', () => {
    const ports = createClientPortsFake(START_AT)
    ports.clock.advance(STEP)
    expect(ports.clock.now()).toBe(START_AT + STEP)
  })
})
