import { CallLimiter } from '../domain/call-limits'
import { NO_PANELS_ON_PAGE, type PanelsOnPage } from './panels-on-page'
import type { ClientPorts } from './ports'
import type { SessionStore } from './session-state'

export interface PendingSnapshot {
  readonly requestId: number
  readonly requestedAt: number
}

export interface PageBookkeeping {
  readonly readyCount: number
  readonly bootCommandSeq: number
  readonly panelsOnPage: PanelsOnPage
  readonly reservedAt: number | null
  readonly pendingSnapshot: PendingSnapshot | null
}

export interface PageBookkeepingStore {
  read(): PageBookkeeping
  write(next: PageBookkeeping): void
}

export interface UseCaseContext {
  readonly ports: ClientPorts
  readonly store: SessionStore
  readonly bookkeeping: PageBookkeepingStore
  readonly limiter: CallLimiter
  readonly kitVersion: string
}

export const EMPTY_PAGE_BOOKKEEPING: PageBookkeeping = Object.freeze({
  readyCount: 0,
  bootCommandSeq: 0,
  panelsOnPage: NO_PANELS_ON_PAGE,
  reservedAt: null,
  pendingSnapshot: null,
})

export function createUseCaseContext(ports: ClientPorts, store: SessionStore, kitVersion: string): UseCaseContext {
  let current = EMPTY_PAGE_BOOKKEEPING
  const bookkeeping: PageBookkeepingStore = {
    read: () => current,
    write: (next) => {
      current = next
    },
  }
  return { ports, store, bookkeeping, limiter: new CallLimiter(), kitVersion }
}

export function updateBookkeeping(context: UseCaseContext, change: Partial<PageBookkeeping>): void {
  context.bookkeeping.write({ ...context.bookkeeping.read(), ...change })
}
