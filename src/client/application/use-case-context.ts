import { CallLimiter } from '../domain/call-limits'
import type { RegisteredPanel } from '../domain/owner-registry'
import type { ClientPorts } from './ports'
import type { SessionStore } from './session-state'

export interface PendingSnapshot {
  readonly requestId: number
  readonly requestedAt: number
}

export interface SentPanel {
  readonly registered: RegisteredPanel
  readonly seq: number
}

export interface LinkMemory {
  readonly readyCount: number
  readonly bootCommandSeq: number
  readonly panelsOnPage: readonly SentPanel[]
  readonly reservedAt: number | null
  readonly pendingSnapshot: PendingSnapshot | null
  readonly printedAt: ReadonlyMap<string, number>
}

export interface LinkMemoryStore {
  read(): LinkMemory
  write(next: LinkMemory): void
}

export interface UseCaseContext {
  readonly ports: ClientPorts
  readonly store: SessionStore
  readonly memory: LinkMemoryStore
  readonly limiter: CallLimiter
  readonly kitVersion: string
}

export const EMPTY_LINK_MEMORY: LinkMemory = Object.freeze({
  readyCount: 0,
  bootCommandSeq: 0,
  panelsOnPage: Object.freeze([]),
  reservedAt: null,
  pendingSnapshot: null,
  printedAt: new Map<string, number>(),
})

export function createUseCaseContext(ports: ClientPorts, store: SessionStore, kitVersion: string): UseCaseContext {
  let current = EMPTY_LINK_MEMORY
  const memory: LinkMemoryStore = {
    read: () => current,
    write: (next) => {
      current = next
    },
  }
  return { ports, store, memory, limiter: new CallLimiter(), kitVersion }
}

export function rememberLink(context: UseCaseContext, change: Partial<LinkMemory>): void {
  context.memory.write({ ...context.memory.read(), ...change })
}
