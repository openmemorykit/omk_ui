import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { vi } from 'vitest'

type EventHandler = (...args: readonly unknown[]) => void
type Implementations = Readonly<Record<string, (...args: never[]) => unknown>>

export interface ServerEventNatives {
  readonly recorder: NativeRecorder
  trigger(name: string, source: unknown, ...args: readonly unknown[]): void
}

export function installServerEventNatives(implementations: Implementations = {}): ServerEventNatives {
  const handlers = new Map<string, EventHandler[]>()
  const register = (name: string, handler: EventHandler): void => {
    handlers.set(name, [...(handlers.get(name) ?? []), handler])
  }
  const recorder = installNatives({ on: register, onNet: register, emitNet: () => undefined, removeEventListener: () => undefined, ...implementations })
  return {
    recorder,
    trigger(name, source, ...args) {
      vi.stubGlobal('source', source)
      handlers.get(name)?.forEach((handler) => handler(...args))
    },
  }
}
