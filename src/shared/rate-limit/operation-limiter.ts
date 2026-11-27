import type { Clock } from '../ports'

export const ONE_LINE_PER_OPERATION_INTERVAL_MS = 60_000
export const OPERATION_KEYS_MAX = 64

export function createOperationLimiter(clock: Clock): (operation: string) => boolean {
  const lastPrintedAt = new Map<string, number>()
  return (operation) => {
    const now = clock.now()
    const last = lastPrintedAt.get(operation)
    if (last !== undefined && now - last < ONE_LINE_PER_OPERATION_INTERVAL_MS) return false
    lastPrintedAt.delete(operation)
    lastPrintedAt.set(operation, now)
    const oldest = lastPrintedAt.keys().next()
    if (lastPrintedAt.size > OPERATION_KEYS_MAX && oldest.done !== true) lastPrintedAt.delete(oldest.value)
    return true
  }
}
