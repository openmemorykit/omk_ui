import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElementViewport, createWindowViewport } from '../../../src/page/infrastructure/viewport'
import type { ViewportSize } from '../../../src/page/application/ports'
import { trackListeners, type ListenerLedger } from './ledger'

const WIDE = 1600
const TALL = 900
const SMALL_SIDE = 10
const LAPTOP_WIDTH = 800
const LAPTOP_HEIGHT = 600

describe('window viewport', () => {
  let ledger: ListenerLedger

  beforeEach(() => {
    ledger = trackListeners(window)
    Object.assign(window, { innerWidth: 1920, innerHeight: 1080 })
  })
  afterEach(() => ledger.restore())

  it('reads the inner size and follows resizes', () => {
    const viewport = createWindowViewport(window)
    const sizes: ViewportSize[] = []
    const stop = viewport.listen((size) => void sizes.push(size))
    expect(viewport.read()).toEqual({ width: 1920, height: 1080 })
    Object.assign(window, { innerWidth: 1280, innerHeight: 720 })
    window.dispatchEvent(new Event('resize'))
    expect(sizes).toEqual([{ width: 1280, height: 720 }])
    stop()
    expect(ledger.active()).toBe(0)
    window.dispatchEvent(new Event('resize'))
    expect(sizes).toHaveLength(1)
  })

  it('keeps notifying the other listeners when one throws', () => {
    const viewport = createWindowViewport(window)
    const seen: number[] = []
    const first = viewport.listen(() => {
      throw new Error('boom')
    })
    const second = viewport.listen((size) => void seen.push(size.width))
    expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow()
    expect(seen).toHaveLength(1)
    first()
    second()
  })
})

interface FakeObserver { readonly callback: ResizeObserverCallback; readonly observed: Element[]; disconnected: boolean }

describe('element viewport', () => {
  const observers: FakeObserver[] = []

  beforeEach(() => {
    observers.length = 0
    class Fake {
      private readonly record: FakeObserver
      constructor(callback: ResizeObserverCallback) {
        this.record = { callback, observed: [], disconnected: false }
        observers.push(this.record)
      }
      observe(target: Element): void { this.record.observed.push(target) }
      unobserve(): void {}
      disconnect(): void { this.record.disconnected = true }
    }
    vi.stubGlobal('ResizeObserver', Fake)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function sized(width: number, height: number): HTMLElement {
    const element = document.createElement('div')
    Object.defineProperty(element, 'clientWidth', { value: width })
    Object.defineProperty(element, 'clientHeight', { value: height })
    return element
  }

  it('reads the element size and forwards observer entries', () => {
    const element = sized(WIDE, TALL)
    const viewport = createElementViewport(element)
    const sizes: ViewportSize[] = []
    const stop = viewport.listen((size) => void sizes.push(size))
    expect(viewport.read()).toEqual({ width: WIDE, height: TALL })
    expect(observers).toHaveLength(1)
    expect(observers[0]?.observed).toEqual([element])
    observers[0]?.callback([{ contentRect: { width: 1280, height: 720 } } as ResizeObserverEntry], {} as ResizeObserver)
    expect(sizes).toEqual([{ width: 1280, height: 720 }])
    stop()
    expect(observers[0]?.disconnected).toBe(true)
  })

  it('opens one observer per listener and ignores an entry list that is empty', () => {
    const viewport = createElementViewport(sized(SMALL_SIDE, SMALL_SIDE))
    const sizes: ViewportSize[] = []
    const stop = viewport.listen((size) => void sizes.push(size))
    observers[0]?.callback([], {} as ResizeObserver)
    expect(sizes).toEqual([])
    stop()
  })

  it('works without ResizeObserver: reads the size, listens to nothing', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const viewport = createElementViewport(sized(LAPTOP_WIDTH, LAPTOP_HEIGHT))
    expect(viewport.read()).toEqual({ width: LAPTOP_WIDTH, height: LAPTOP_HEIGHT })
    expect(() => viewport.listen(() => undefined)()).not.toThrow()
  })
})
