import { vi } from 'vitest'
import type { HostBridge, Viewport, ViewportSize } from '../../../src/page/application/ports'
import { createPageApp, type PageApp, type PageAppOptions } from '../../../src/page/bootstrap'
import { FromPage, type FromPageMessage } from '../../../src/protocol/from-page'
import type { ToPageMessage } from '../../../src/protocol/to-page'

export const FULL_HD: ViewportSize = { width: 1920, height: 1080 }
export const ROOT_SELECTOR = '.omk-app'
export const FRAME_MS = 16

export interface ScriptedHost extends HostBridge {
  readonly sent: FromPageMessage[]
  listening(): number
  emit(message: ToPageMessage): void
}

export interface FakeViewport extends Viewport {
  resize(size: ViewportSize): void
}

export function scriptedHost(): ScriptedHost {
  const listeners = new Set<(message: ToPageMessage) => void>()
  const sent: FromPageMessage[] = []
  return {
    sent,
    listening: () => listeners.size,
    emit: (message) => [...listeners].forEach((listener) => listener(message)),
    send: (message) => void sent.push(message),
    listen(listener) {
      listeners.add(listener)
      if (listeners.size === 1) sent.push({ type: FromPage.Ready })
      return () => void listeners.delete(listener)
    },
  }
}

export function fakeViewport(initial: ViewportSize = FULL_HD): FakeViewport {
  let size = initial
  const listeners = new Set<(next: ViewportSize) => void>()
  return {
    read: () => size,
    listen(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    resize(next) {
      size = next
      listeners.forEach((listener) => listener(next))
    },
  }
}

export interface MountedPage<Host extends HostBridge = HostBridge> {
  readonly app: PageApp
  readonly container: HTMLElement
  readonly host: Host
  readonly viewport: FakeViewport
  root(): HTMLElement
  frame(): void
  unmount(): void
}

export function mountOn<Host extends HostBridge>(host: Host, options: Partial<PageAppOptions> = {}): MountedPage<Host> {
  const viewport = fakeViewport()
  const container = document.createElement('div')
  document.body.append(container)
  const app = createPageApp({ host, win: window, viewport, ...options })
  app.mount(container)
  return {
    app,
    container,
    host,
    viewport,
    root: () => {
      const root = container.querySelector<HTMLElement>(ROOT_SELECTOR)
      if (root === null) throw new Error('page root missing')
      return root
    },
    frame: () => void vi.advanceTimersByTime(FRAME_MS),
    unmount: () => {
      app.dispose()
      container.remove()
    },
  }
}

export function mountScripted(options: Partial<PageAppOptions> = {}): MountedPage<ScriptedHost> {
  return mountOn(scriptedHost(), options)
}
