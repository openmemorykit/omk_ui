import { rememberLink, type UseCaseContext } from './use-case-context'

export const CONSOLE_PREFIX = '[omk_ui]'
export const PRINTED_KEYS_MAX = 64
export const ONE_LINE_PER_SECOND_MS = 1000

export function printConsoleLine(context: UseCaseContext, line: string): void {
  try {
    context.ports.console.print(`${CONSOLE_PREFIX} ${line}`)
  } catch {
    return
  }
}

function rememberedAt(printedAt: ReadonlyMap<string, number>, key: string, now: number): ReadonlyMap<string, number> {
  const remembered = new Map(printedAt)
  remembered.delete(key)
  remembered.set(key, now)
  const oldest = remembered.keys().next()
  if (remembered.size > PRINTED_KEYS_MAX && oldest.done !== true) remembered.delete(oldest.value)
  return remembered
}

export function printConsoleLimited(context: UseCaseContext, key: string, line: string, intervalMs: number): void {
  const now = context.ports.clock.now()
  const { printedAt } = context.memory.read()
  const lastPrintedAt = printedAt.get(key)
  if (lastPrintedAt !== undefined && now - lastPrintedAt < intervalMs) return
  rememberLink(context, { printedAt: rememberedAt(printedAt, key, now) })
  printConsoleLine(context, line)
}
