import { ItemKind, PanelKind, type Item, type Panel } from '@openmemorykit/ui/contract'
import type { ValueOf } from '@openmemorykit/core/shared'
import { UiMode } from '../../../protocol/page-vocabulary'
import { isFocusable, renderWindow, VISIBLE_ROWS } from '../../domain/list-focus'
import { FORM_SUBMIT_ROW_ID } from '../../domain/panel-rows'
import type { Frame, UiState } from '../../domain/ui-state'
import type { Translate } from '../../i18n/messages'
import { formSubmitView, type FormSubmitView } from './form-submit-view'
import { rowElementId, rowView, type RowView } from './row-view'

const BRANDING_BASE = '../branding/'

export const BrandKind = { Logo: 'logo', Monogram: 'monogram' } as const
export type BrandKind = ValueOf<typeof BrandKind>

export interface BrandView { readonly kind: BrandKind; readonly logo: string | null; readonly monogram: string }
export interface CrumbView { readonly id: string; readonly title: string }
export interface CounterView { readonly position: number; readonly total: number; readonly text: string }
export interface DescriptionView { readonly text: string; readonly disabled: boolean }

export const ColumnRowKind = { Item: 'item', Submit: 'submit' } as const
export type ColumnRow =
  | { readonly kind: typeof ColumnRowKind.Item; readonly id: string; readonly row: RowView }
  | { readonly kind: typeof ColumnRowKind.Submit; readonly id: string; readonly submit: FormSubmitView }

export interface ColumnView {
  readonly panelId: string
  readonly side: UiState['settings']['side']
  readonly brand: BrandView
  readonly title: string
  readonly subtitle: string | null
  readonly depth: number
  readonly crumbs: readonly CrumbView[]
  readonly rows: readonly ColumnRow[]
  readonly windowStart: number
  readonly rowCount: number
  readonly hiddenBefore: number
  readonly hiddenAfter: number
  readonly counter: CounterView | null
  readonly canScrollUp: boolean
  readonly canScrollDown: boolean
  readonly emptyText: string | null
  readonly description: DescriptionView | null
  readonly dimmed: boolean
  readonly covered: boolean
  readonly activeDescendant: string | null
}

const NONE = 0
const NEXT = 1
const FIRST_LEVEL_ONLY = 1

function totalRows(panel: Panel): number {
  return panel.items.length + (panel.kind === PanelKind.Form ? NEXT : NONE)
}

function clampedStart(frame: Frame, total: number): number {
  const start = Number.isFinite(frame.visibleStart) ? Math.trunc(frame.visibleStart) : NONE
  return Math.min(Math.max(start, NONE), Math.max(total - VISIBLE_ROWS, NONE))
}

function rowsOf(panel: Panel, frame: Frame, translate: Translate): { readonly start: number; readonly rows: readonly ColumnRow[] } {
  const total = totalRows(panel)
  const window = renderWindow(total, frame.visibleStart)
  const items = panel.items.slice(window.start, Math.min(window.end, panel.items.length))
  const rows: ColumnRow[] = items.map((item) => {
    const row = rowView(item, frame, translate)
    return Object.freeze({ kind: ColumnRowKind.Item, id: item.id, row })
  })
  if (panel.kind === PanelKind.Form && window.end > panel.items.length) {
    rows.push(Object.freeze({ kind: ColumnRowKind.Submit, id: FORM_SUBMIT_ROW_ID, submit: formSubmitView(frame, translate) }))
  }
  return { start: window.start, rows }
}

function counterOf(panel: Panel, frame: Frame, translate: Translate): CounterView | null {
  const ids = panel.items.filter(isFocusable).map((item) => item.id)
  if (panel.kind === PanelKind.Form) ids.push(FORM_SUBMIT_ROW_ID)
  if (ids.length === NONE) return null
  const position = frame.focusItemId === null ? NONE : ids.indexOf(frame.focusItemId) + NEXT
  return Object.freeze({ position, total: ids.length, text: translate('ui.form.counter', { current: position, total: ids.length }) })
}

function focusedItem(panel: Panel, frame: Frame): Item | undefined {
  return panel.items.find((item) => item.id === frame.focusItemId)
}

function descriptionOf(panel: Panel, frame: Frame): DescriptionView | null {
  const item = focusedItem(panel, frame)
  if (item === undefined) return null
  if (item.kind === ItemKind.Section) return null
  if (item.disabled !== undefined) return Object.freeze({ text: item.disabled.reason, disabled: true })
  return item.description === undefined ? null : Object.freeze({ text: item.description, disabled: false })
}

function brandOf(state: UiState): BrandView {
  const { logo, monogram } = state.settings
  return Object.freeze({ kind: logo === null ? BrandKind.Monogram : BrandKind.Logo, logo: logo === null ? null : `${BRANDING_BASE}${logo}`, monogram })
}

function levelsOf(state: UiState): readonly CrumbView[] {
  return state.stack.flatMap((frame) => (frame.panel === null ? [] : [Object.freeze({ id: frame.panel.panel.id, title: frame.panel.panel.title })]))
}

function isShown(state: UiState): boolean {
  return state.mode === UiMode.Panels || state.mode === UiMode.Radial
}

export function columnView(state: UiState, translate: Translate): ColumnView | null {
  const frame = state.stack[state.stack.length - NEXT]
  const panel = frame?.panel?.panel
  if (frame === undefined || panel === undefined || !isShown(state)) return null
  const { start, rows } = rowsOf(panel, frame, translate)
  const total = totalRows(panel)
  const first = clampedStart(frame, total)
  const covered = frame.layers.length > NONE
  const levels = levelsOf(state)
  const focusedRow = rows.find((row) => frame.focusItemId === row.id)
  return Object.freeze({
    panelId: panel.id,
    side: state.settings.side,
    brand: brandOf(state),
    title: panel.title,
    subtitle: panel.subtitle ?? null,
    depth: levels.length,
    crumbs: Object.freeze(levels.length > FIRST_LEVEL_ONLY ? levels : []),
    rows: Object.freeze(rows),
    windowStart: start,
    rowCount: total,
    hiddenBefore: start,
    hiddenAfter: total - start - rows.length,
    counter: counterOf(panel, frame, translate),
    canScrollUp: first > NONE,
    canScrollDown: first + VISIBLE_ROWS < total,
    emptyText: total === NONE ? panel.emptyText ?? null : null,
    description: descriptionOf(panel, frame),
    dimmed: state.mode === UiMode.Radial,
    covered,
    activeDescendant: covered || focusedRow === undefined ? null : rowElementId(focusedRow.id),
  })
}
