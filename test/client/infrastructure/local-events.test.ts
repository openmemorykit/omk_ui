import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { createLocalEvents, LocalEventName } from '../../../src/client/infrastructure/local-events'

let natives: NativeRecorder | null = null

afterEach(() => {
  natives?.restore()
  natives = null
})

describe('createLocalEvents', () => {
  it('emits omk_ui:ready locally, without payload', () => {
    natives = installNatives({ emit: () => undefined })
    createLocalEvents(() => undefined).emitReady()
    expect(natives.callsOf('emit')).toEqual([[LocalEventName.Ready]])
    expect(LocalEventName.Ready).toBe('omk_ui:ready')
  })

  it('reports a failing emit and lets nothing escape', () => {
    const failures: string[] = []
    natives = installNatives({ emit: () => { throw new Error('boom') } })
    createLocalEvents((operation) => failures.push(operation)).emitReady()
    expect(failures).toEqual(['emit omk_ui:ready'])
  })
})
