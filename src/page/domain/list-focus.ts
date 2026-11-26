import { ItemKind } from '@openmemorykit/ui/contract'
import type { Item } from '@openmemorykit/ui/contract'

export const VISIBLE_ROWS = 10
export const RENDER_OVERSCAN = 10

export function isFocusable(item: Item): boolean {
  if (item.kind === ItemKind.Section) return false
  if (item.kind === ItemKind.Info) return item.description !== undefined
  return true
}

function focusableIds(items: readonly Item[]): readonly string[] {
  return items.filter(isFocusable).map((item) => item.id)
}

function clampedInteger(value: number, maximum: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(Math.max(Math.trunc(value), 0), Math.max(maximum, 0))
}

function survivorAfterOrBefore(items: readonly Item[], previousItems: readonly Item[], previousIndex: number): string | null {
  const survivors: ReadonlySet<string> = new Set(focusableIds(items))
  const isSurvivor = (item: Item): boolean => survivors.has(item.id)
  const after = previousItems.slice(previousIndex + 1).find(isSurvivor)
  const before = previousItems.slice(0, previousIndex).reverse().find(isSurvivor)
  return (after ?? before)?.id ?? null
}

export function firstFocusable(items: readonly Item[]): string | null {
  return focusableIds(items)[0] ?? null
}

export function moveFocus(items: readonly Item[], currentId: string | null, step: 1 | -1): string | null {
  const ids = focusableIds(items)
  if (ids.length === 0) return null
  const current = currentId === null ? -1 : ids.indexOf(currentId)
  const target = current === -1 ? (step === 1 ? 0 : ids.length - 1) : (current + step + ids.length) % ids.length
  return ids[target] ?? null
}

export function nearestFocusable(items: readonly Item[], previousItems: readonly Item[], previousId: string | null): string | null {
  const kept = items.find((item) => item.id === previousId)
  if (kept !== undefined && isFocusable(kept)) return kept.id
  const previousIndex = previousItems.findIndex((item) => item.id === previousId)
  if (previousIndex === -1) return firstFocusable(items)
  return survivorAfterOrBefore(items, previousItems, previousIndex) ?? firstFocusable(items)
}

export function visibleWindowStart(itemCount: number, focusIndex: number, previousStart: number): number {
  const count = clampedInteger(itemCount, Number.MAX_SAFE_INTEGER)
  const lastIndex = Math.max(count - 1, 0)
  const lastStart = Math.max(count - VISIBLE_ROWS, 0)
  const start = clampedInteger(previousStart, lastStart)
  if (Number.isNaN(focusIndex) || focusIndex < 0) return start
  const focus = clampedInteger(focusIndex, lastIndex)
  if (focus < start) return focus
  return focus >= start + VISIBLE_ROWS ? focus - VISIBLE_ROWS + 1 : start
}

export function renderWindow(itemCount: number, visibleStart: number): { readonly start: number; readonly end: number } {
  const count = clampedInteger(itemCount, Number.MAX_SAFE_INTEGER)
  const start = clampedInteger(visibleStart, count - VISIBLE_ROWS)
  return { start: Math.max(start - RENDER_OVERSCAN, 0), end: Math.min(start + VISIBLE_ROWS + RENDER_OVERSCAN, count) }
}

export function focusCounter(items: readonly Item[], focusId: string | null): { readonly position: number; readonly total: number } {
  const ids = focusableIds(items)
  return { position: focusId === null ? 0 : ids.indexOf(focusId) + 1, total: ids.length }
}
