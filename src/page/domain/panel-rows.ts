import { PanelKind, type Item, type Panel } from '@openmemorykit/ui/contract'
import { isFocusable, visibleWindowStart } from './list-focus'

export const FORM_SUBMIT_ROW_ID = '__submit'

export type RowStep = 1 | -1

const NOT_FOUND = -1
const FIRST_ROW = 0
const NEXT = 1
const SUBMIT_ROWS = 1
const NO_ROWS = 0
const NO_LABEL = ''

const hasSubmitRow = (panel: Panel): boolean => panel.kind === PanelKind.Form

export function isSubmitRow(panel: Panel, rowId: unknown): boolean {
  return hasSubmitRow(panel) && rowId === FORM_SUBMIT_ROW_ID
}

export function focusableItem(panel: Panel, rowId: unknown): Item | undefined {
  const item = panel.items.find((candidate) => candidate.id === rowId)
  return item !== undefined && isFocusable(item) ? item : undefined
}

export function isFocusableRow(panel: Panel, rowId: unknown): rowId is string {
  return isSubmitRow(panel, rowId) || focusableItem(panel, rowId) !== undefined
}

function focusableRowIds(panel: Panel): readonly string[] {
  const ids = panel.items.filter(isFocusable).map((item) => item.id)
  return hasSubmitRow(panel) ? ids.concat(FORM_SUBMIT_ROW_ID) : ids
}

export function steppedRowId(panel: Panel, currentId: string | null, step: RowStep): string | null {
  const ids = focusableRowIds(panel)
  if (ids.length === NO_ROWS) return null
  const current = currentId === null ? NOT_FOUND : ids.indexOf(currentId)
  const target = current === NOT_FOUND ? (step === NEXT ? FIRST_ROW : ids.length - NEXT) : (current + step + ids.length) % ids.length
  return ids[target] ?? null
}

export function rowWindowStart(panel: Panel, rowId: string | null, previousStart: number): number {
  const index = isSubmitRow(panel, rowId) ? panel.items.length : panel.items.findIndex((item) => item.id === rowId)
  const count = panel.items.length + (hasSubmitRow(panel) ? SUBMIT_ROWS : NO_ROWS)
  return visibleWindowStart(count, index, previousStart)
}

export function rowLabel(panel: Panel, rowId: string): string {
  if (panel.kind === PanelKind.Form && rowId === FORM_SUBMIT_ROW_ID) return panel.submitLabel
  return focusableItem(panel, rowId)?.label ?? NO_LABEL
}
