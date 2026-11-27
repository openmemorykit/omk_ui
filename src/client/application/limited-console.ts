import type { ClientPorts } from './ports'
import type { SessionStore } from './session-state'
import { limitedWindowStillOpen, rememberedAt } from './trace'
import type { UseCaseContext } from './use-case-context'

export const ONE_LINE_PER_SECOND_MS = 1000
export const ONCE_PER_KIT_LIFETIME = Number.POSITIVE_INFINITY

const CONSOLE_KEY_PREFIX = 'console:'
const CONSOLE_PREFIX = '[omk_ui]'

export function printLimited(ports: ClientPorts, store: SessionStore, key: string, intervalMs: number, line: string): void {
  const now = ports.clock.now()
  const session = store.read()
  const consoleKey = `${CONSOLE_KEY_PREFIX}${key}`
  if (limitedWindowStillOpen(session.trace.lastLimitedAt, consoleKey, now, intervalMs)) return
  store.write({ ...session, trace: { ...session.trace, lastLimitedAt: rememberedAt(session.trace.lastLimitedAt, consoleKey, now) } })
  ports.console.print(line)
}

export function printLimitedLine(context: UseCaseContext, key: string, intervalMs: number, text: string): void {
  try {
    printLimited(context.ports, context.store, key, intervalMs, `${CONSOLE_PREFIX} ${text}`)
  } catch {
    return
  }
}
