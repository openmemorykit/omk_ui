import { describe, expect, it } from 'vitest'
import type { Scheduler } from '../../../../src/page/application/ports'
import { createPreviewHost } from '../../../../src/page/infrastructure/host/preview-host'
import { FromPage, type FromPageMessage } from '../../../../src/protocol/from-page'
import { ToPage, type ToPageMessage } from '../../../../src/protocol/to-page'
import { DEFAULT_PREVIEW_SETTINGS } from '../../../../preview/runtime/preview-settings'
import { createPreviewRuntime } from '../../../../preview/runtime/scenario-runner'
import { ScenarioId, type PreviewRuntime } from '../../../../preview/runtime/types'
import { FROM_PAGE_SAMPLES, TO_PAGE_SAMPLES } from '../../../fixtures/messages'

const READY: FromPageMessage = FROM_PAGE_SAMPLES[FromPage.Ready]
const ORDER_LISTEN = 'listen'

interface FakeRuntime {
  readonly runtime: PreviewRuntime
  readonly delivered: FromPageMessage[]
  readonly order: string[]
  emit(message: ToPageMessage): void
  failDeliver(): void
}

function createFakeRuntime(): FakeRuntime {
  const delivered: FromPageMessage[] = []
  const order: string[] = []
  const listeners = new Set<(message: ToPageMessage) => void>()
  let failing = false
  const runtime: PreviewRuntime = {
    start: () => undefined,
    deliver(message) {
      if (failing) throw new Error('runtime broke')
      order.push(message.type)
      delivered.push(message)
    },
    listen(listener) {
      order.push(ORDER_LISTEN)
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    log: () => [],
    onLog: () => () => undefined,
    settled: () => false,
  }
  return {
    runtime,
    delivered,
    order,
    emit: (message) => [...listeners].forEach((listener) => listener(message)),
    failDeliver: () => void (failing = true),
  }
}

describe('preview host', () => {
  it('asks for boot with ready once the first listener is attached', () => {
    const fake = createFakeRuntime()
    createPreviewHost(fake.runtime).listen(() => undefined)
    expect(fake.order).toEqual([ORDER_LISTEN, FromPage.Ready])
    expect(fake.delivered).toEqual([READY])
  })

  it('sends ready again only after every listener left', () => {
    const fake = createFakeRuntime()
    const host = createPreviewHost(fake.runtime)
    const stop = host.listen(() => undefined)
    host.listen(() => undefined)()
    stop()
    stop()
    host.listen(() => undefined)
    expect(fake.delivered).toEqual([READY, READY])
  })

  it('delivers page messages to the runtime unchanged, without token', () => {
    const fake = createFakeRuntime()
    createPreviewHost(fake.runtime).send(FROM_PAGE_SAMPLES[FromPage.Event])
    expect(fake.delivered).toEqual([FROM_PAGE_SAMPLES[FromPage.Event]])
  })

  it('relays runtime messages until the listener stops', () => {
    const fake = createFakeRuntime()
    const received: ToPageMessage[] = []
    const stop = createPreviewHost(fake.runtime).listen((message) => void received.push(message))
    fake.emit(TO_PAGE_SAMPLES[ToPage.OpenRadial])
    stop()
    fake.emit(TO_PAGE_SAMPLES[ToPage.Notify])
    expect(received).toEqual([TO_PAGE_SAMPLES[ToPage.OpenRadial]])
  })

  it('keeps a throwing listener from reaching the runtime or the other listeners', () => {
    const fake = createFakeRuntime()
    const host = createPreviewHost(fake.runtime)
    const received: ToPageMessage[] = []
    host.listen(() => {
      throw new Error('listener broke')
    })
    host.listen((message) => void received.push(message))
    expect(() => fake.emit(TO_PAGE_SAMPLES[ToPage.OpenRadial])).not.toThrow()
    expect(received).toEqual([TO_PAGE_SAMPLES[ToPage.OpenRadial]])
  })

  it('swallows a runtime that throws on delivery', () => {
    const fake = createFakeRuntime()
    fake.failDeliver()
    const host = createPreviewHost(fake.runtime)
    expect(() => host.listen(() => undefined)).not.toThrow()
    expect(() => host.send(FROM_PAGE_SAMPLES[FromPage.Ack])).not.toThrow()
  })

  it('boots the page from the real runtime once a scenario starts', () => {
    const scheduler: Scheduler = { schedule: () => undefined, cancel: () => undefined }
    const runtime = createPreviewRuntime({ clock: { now: () => 0 }, scheduler })
    const received: ToPageMessage[] = []
    createPreviewHost(runtime).listen((message) => void received.push(message))
    runtime.start(ScenarioId.Radial, DEFAULT_PREVIEW_SETTINGS)
    expect(received.map((message) => message.type)).toContain(ToPage.Boot)
    expect(Object.hasOwn(received[0] ?? {}, 'sessionToken')).toBe(false)
  })
})
