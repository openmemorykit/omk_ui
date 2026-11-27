import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerResourceStop, RESOURCE_STOP_EVENT, ResourceStopOperation } from '../../../src/client/infrastructure/resource-stop'

const KIT = 'omk_ui'
const OTHER = 'garage'
const NUMERIC_NAME = 7

type StopListener = (name: unknown) => void

let natives: NativeRecorder | null = null
let listeners: StopListener[] = []

function install(overrides: Readonly<Record<string, (...args: never[]) => unknown>> = {}): void {
  listeners = []
  natives = installNatives({
    GetCurrentResourceName: () => KIT,
    on: (_name: string, listener: StopListener) => listeners.push(listener),
    ...overrides,
  })
}

function stop(name: unknown): void {
  listeners.forEach((listener) => listener(name))
}

afterEach(() => {
  natives?.restore()
  natives = null
})

describe('registerResourceStop', () => {
  it('listens to onResourceStop once, as a local event', () => {
    install()
    registerResourceStop({ onOtherResourceStopped: vi.fn(), onSelfStopping: vi.fn() }, vi.fn())
    expect(natives?.callsOf('on').map(([name]) => name)).toEqual([RESOURCE_STOP_EVENT])
    expect(RESOURCE_STOP_EVENT).toBe('onResourceStop')
  })

  it('tells the kit it is stopping when the stopped resource is the current one', () => {
    install()
    const handlers = { onOtherResourceStopped: vi.fn(), onSelfStopping: vi.fn() }
    registerResourceStop(handlers, vi.fn())
    stop(KIT)
    expect(handlers.onSelfStopping).toHaveBeenCalledTimes(1)
    expect(handlers.onOtherResourceStopped).not.toHaveBeenCalled()
  })

  it('hands the name of another stopped resource to the kit', () => {
    install()
    const handlers = { onOtherResourceStopped: vi.fn(), onSelfStopping: vi.fn() }
    registerResourceStop(handlers, vi.fn())
    stop(OTHER)
    expect(handlers.onOtherResourceStopped).toHaveBeenCalledWith(OTHER)
    expect(handlers.onSelfStopping).not.toHaveBeenCalled()
  })

  it('reads the current resource name at each event, not at registration', () => {
    let current = KIT
    install({ GetCurrentResourceName: () => current })
    const handlers = { onOtherResourceStopped: vi.fn(), onSelfStopping: vi.fn() }
    registerResourceStop(handlers, vi.fn())
    current = OTHER
    stop(OTHER)
    expect(handlers.onSelfStopping).toHaveBeenCalledTimes(1)
  })

  it('ignores an event whose resource name is not a text', () => {
    install()
    const handlers = { onOtherResourceStopped: vi.fn(), onSelfStopping: vi.fn() }
    registerResourceStop(handlers, vi.fn())
    ;[undefined, null, NUMERIC_NAME, {}].forEach(stop)
    expect(handlers.onOtherResourceStopped).not.toHaveBeenCalled()
    expect(handlers.onSelfStopping).not.toHaveBeenCalled()
  })

  it('keeps a failing handler out of the event and reports it', () => {
    install()
    const failure = new Error('handler broke')
    const onFailure = vi.fn()
    registerResourceStop({ onOtherResourceStopped: () => { throw failure }, onSelfStopping: () => { throw failure } }, onFailure)
    expect(() => {
      stop(OTHER)
      stop(KIT)
    }).not.toThrow()
    expect(onFailure.mock.calls).toEqual([[ResourceStopOperation.Event, failure], [ResourceStopOperation.Event, failure]])
  })

  it('keeps a failing GetCurrentResourceName out of the event and reports it', () => {
    const failure = new Error('native broke')
    install({ GetCurrentResourceName: () => { throw failure } })
    const onFailure = vi.fn()
    registerResourceStop({ onOtherResourceStopped: vi.fn(), onSelfStopping: vi.fn() }, onFailure)
    expect(() => stop(OTHER)).not.toThrow()
    expect(onFailure).toHaveBeenCalledWith(ResourceStopOperation.Event, failure)
  })

  it('keeps a failing registration out of startup and reports it', () => {
    const failure = new Error('on broke')
    install({ on: () => { throw failure } })
    const onFailure = vi.fn()
    expect(() => registerResourceStop({ onOtherResourceStopped: vi.fn(), onSelfStopping: vi.fn() }, onFailure)).not.toThrow()
    expect(onFailure).toHaveBeenCalledWith(ResourceStopOperation.Register, failure)
  })
})
