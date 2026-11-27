import { appendTrace, type TraceBuffer, type TraceLine } from '../domain/trace-buffer'
import type { ClientPorts } from './ports'
import type { SessionStore } from './session-state'

export const ONE_LINE_PER_MINUTE_MS = 60_000
export const LIMITED_TRACE_KEYS_MAX = 256

function sendNewestLine(ports: ClientPorts, buffer: TraceBuffer): void {
  buffer.lines.slice(-1).forEach((newest) => ports.server.report(newest))
}

function recordLine(ports: ClientPorts, store: SessionStore, line: TraceLine): void {
  const session = store.read()
  const buffer = appendTrace(session.trace.buffer, line)
  if (buffer === session.trace.buffer) return
  store.write({ ...session, trace: { ...session.trace, buffer } })
  if (session.trace.active) sendNewestLine(ports, buffer)
}

export function traceLine(ports: ClientPorts, store: SessionStore, line: TraceLine): void {
  try {
    recordLine(ports, store, line)
  } catch {
    return
  }
}

function rememberedAt(lastLimitedAt: ReadonlyMap<string, number>, key: string, now: number): ReadonlyMap<string, number> {
  const remembered = new Map(lastLimitedAt)
  remembered.delete(key)
  remembered.set(key, now)
  const oldest = remembered.keys().next()
  if (remembered.size > LIMITED_TRACE_KEYS_MAX && oldest.done !== true) remembered.delete(oldest.value)
  return remembered
}

export function traceLimited(ports: ClientPorts, store: SessionStore, line: TraceLine, key: string, intervalMs: number): void {
  const now = ports.clock.now()
  const session = store.read()
  const lastWrittenAt = session.trace.lastLimitedAt.get(key)
  if (lastWrittenAt !== undefined && now - lastWrittenAt < intervalMs) return
  store.write({ ...session, trace: { ...session.trace, lastLimitedAt: rememberedAt(session.trace.lastLimitedAt, key, now) } })
  traceLine(ports, store, line)
}
