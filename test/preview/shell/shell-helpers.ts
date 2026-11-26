import { vi, type Mock } from 'vitest'
import { LogKind, type LogEntry, type PreviewRuntime } from '../../../preview/runtime/types'
import { FromPage } from '../../../src/protocol/from-page'

export interface StubRuntime extends PreviewRuntime {
  readonly start: Mock<PreviewRuntime['start']>
  entries: LogEntry[]
  done: boolean
  emitLog(): void
}

export function stubRuntime(): StubRuntime {
  const logListeners = new Set<() => void>()
  const runtime: StubRuntime = {
    entries: [],
    done: false,
    start: vi.fn(),
    deliver: vi.fn(),
    listen: () => () => undefined,
    log: () => runtime.entries,
    onLog: (listener) => {
      logListeners.add(listener)
      return () => logListeners.delete(listener)
    },
    settled: () => runtime.done,
    emitLog: () => logListeners.forEach((listener) => listener()),
  }
  return runtime
}

export function fromPageEntry(at: number): LogEntry {
  return { at, event: { kind: LogKind.FromPage, message: { type: FromPage.Ready } } }
}
