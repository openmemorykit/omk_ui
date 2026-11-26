import { ItemKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { BrandKind, ColumnRowKind, columnView } from '../../../../src/page/application/views/column-view'
import { FORM_SUBMIT_ROW_ID } from '../../../../src/page/domain/panel-rows'
import { RENDER_OVERSCAN, VISIBLE_ROWS } from '../../../../src/page/domain/list-focus'
import { ConfirmChoice, ConfirmOrigin, LayerKind, createInitialState } from '../../../../src/page/domain/ui-state'
import { PanelSide } from '../../../../src/shared/config/config-schema'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import { ENABLED_TOGGLE, PURGE_ACTION } from '../../../fixtures/items'
import { formState, hasFunction, isDeeplyFrozen, manyItems, omit, panelsState, pushedState, stateOfItems, topFrameOf, translate, withTop } from './column-fixtures'

const MANY = 1000
const TWO = 2
const FORM_ROWS = 4
const MAX_RENDERED = 30
const DEEP_START = 500
const TWELVE_ROWS = 12
const COVER = { kind: LayerKind.Confirm, origin: ConfirmOrigin.Request, content: { title: 'T', text: 'X', confirmLabel: 'Go' }, confirmId: null, itemId: null, choice: ConfirmChoice.Cancel } as const

function column(state = panelsState()): NonNullable<ReturnType<typeof columnView>> {
  const view = columnView(state, translate)
  if (view === null) throw new Error('column expected')
  return view
}

describe('columnView visibility', () => {
  it('is hidden without panel, when idle or waiting', () => {
    expect(columnView(createInitialState(), translate)).toBeNull()
    expect(columnView({ ...panelsState(), mode: UiMode.Idle }, translate)).toBeNull()
    expect(columnView({ ...panelsState(), mode: UiMode.Waiting }, translate)).toBeNull()
  })

  it('is hidden when the top frame carries only a confirmation', () => {
    const state = panelsState()
    expect(columnView({ ...state, stack: state.stack.concat({ ...topFrameOf(state), panel: null, form: null }) }, translate)).toBeNull()
  })

  it('is dimmed when the radial is open and not otherwise', () => {
    expect(column({ ...panelsState(), mode: UiMode.Radial }).dimmed).toBe(true)
    expect(column().dimmed).toBe(false)
  })

  it('is covered under a layer and not otherwise', () => {
    expect(column(withTop(panelsState(), { layers: [COVER] })).covered).toBe(true)
    expect(column().covered).toBe(false)
  })
})

describe('columnView banner and trail', () => {
  it('renders the title, the subtitle and the monogram', () => {
    expect(column()).toMatchObject({ title: 'Whitelist', subtitle: 'Page 1 of 1', brand: { kind: BrandKind.Monogram, logo: null }, side: PanelSide.Left })
  })

  it('renders the logo and the right side', () => {
    const state = panelsState()
    const view = column({ ...state, settings: { ...state.settings, logo: 'logo.png', side: PanelSide.Right } })
    expect(view).toMatchObject({ brand: { kind: BrandKind.Logo, logo: 'logo.png' }, side: PanelSide.Right })
  })

  it('has a null subtitle when the panel has none', () => {
    const state = formState()
    expect(column(state).subtitle).toBeNull()
  })

  it('lists the levels of the stack', () => {
    const view = column(pushedState(panelsState()))
    expect(view.crumbs.map((crumb) => crumb.title)).toEqual(['Whitelist', 'Whitelist'])
    expect(new Set(view.crumbs.map((crumb) => crumb.id)).size).toBe(TWO)
  })

  it('skips frames without panel in the trail', () => {
    const state = panelsState()
    const withCover = { ...state, stack: [{ ...topFrameOf(state), panel: null, form: null }, ...state.stack] }
    expect(column(withCover).crumbs).toHaveLength(1)
  })
})

describe('columnView rows', () => {
  it('renders the items in order', () => {
    const view = column()
    expect(view.rows.map((row) => row.id)).toEqual(['enabled', 'add', 'players', 'player-1', 'count', 'purge', 'remove-all'])
    expect(view.rows.every((row) => row.kind === ColumnRowKind.Item)).toBe(true)
    expect(view).toMatchObject({ windowStart: 0, rowCount: 7 })
  })

  it('appends the submit row of a form', () => {
    const view = column(formState())
    const last = view.rows[view.rows.length - 1]
    expect(view.rows).toHaveLength(FORM_ROWS)
    expect(last).toMatchObject({ kind: ColumnRowKind.Submit, id: FORM_SUBMIT_ROW_ID })
    expect(view.rowCount).toBe(FORM_ROWS)
  })

  it('renders at most 30 rows out of a thousand, around the focus', () => {
    const state = withTop(stateOfItems(manyItems(MANY)), { visibleStart: DEEP_START, focusItemId: 'row-505' })
    const view = column(state)
    expect(view.rows.length).toBeLessThanOrEqual(MAX_RENDERED)
    expect(view.rows).toHaveLength(VISIBLE_ROWS + RENDER_OVERSCAN * TWO)
    expect(view.windowStart).toBe(DEEP_START - RENDER_OVERSCAN)
    expect(view.rows[0]?.id).toBe('row-490')
    expect(view.rowCount).toBe(MANY)
  })

  it('never renders the submit row of a long form far from its end', () => {
    const state = withTop(stateOfItems(manyItems(MANY)), { visibleStart: 0 })
    expect(column(state).rows.some((row) => row.kind === ColumnRowKind.Submit)).toBe(false)
  })

  it('shows the example text when a panel has no row', () => {
    expect(column(stateOfItems([])).emptyText).toBe('No player yet')
    expect(column().emptyText).toBeNull()
  })

  it('has no empty text when the panel declares none', () => {
    const state = stateOfItems([])
    const panel = state.stack[0]?.panel
    if (panel === null || panel === undefined) throw new Error('panel expected')
    const bare = withTop(state, { panel: { owner: panel.owner, panel: omit(panel.panel, 'emptyText') as typeof panel.panel } })
    expect(column(bare).emptyText).toBeNull()
  })
})

describe('columnView footer', () => {
  it('counts the focus among the focusable rows', () => {
    expect(column().counter).toEqual({ position: 1, total: 5, text: '1/5' })
    expect(column(withTop(panelsState(), { focusItemId: 'purge' })).counter).toMatchObject({ position: 4, total: 5 })
  })

  it('counts the submit row of a form', () => {
    expect(column(withTop(formState(), { focusItemId: FORM_SUBMIT_ROW_ID })).counter).toMatchObject({ position: 4, total: 4 })
  })

  it('has no counter without focusable rows and a zero position without focus', () => {
    expect(column(stateOfItems([])).counter).toBeNull()
    expect(column(withTop(panelsState(), { focusItemId: null })).counter).toMatchObject({ position: 0, total: 5 })
  })

  it('shows the scroll arrows according to the window', () => {
    const items = manyItems(TWELVE_ROWS)
    expect(column(stateOfItems(items))).toMatchObject({ canScrollUp: false, canScrollDown: true })
    expect(column(withTop(stateOfItems(items), { visibleStart: 2 }))).toMatchObject({ canScrollUp: true, canScrollDown: false })
    expect(column(withTop(stateOfItems(items), { visibleStart: 1 }))).toMatchObject({ canScrollUp: true, canScrollDown: true })
    expect(column()).toMatchObject({ canScrollUp: false, canScrollDown: false })
  })

  it('clamps a hostile window start', () => {
    const items = manyItems(TWELVE_ROWS)
    expect(column(withTop(stateOfItems(items), { visibleStart: Number.NaN }))).toMatchObject({ canScrollUp: false, canScrollDown: true })
    expect(column(withTop(stateOfItems(items), { visibleStart: 99 }))).toMatchObject({ canScrollUp: true, canScrollDown: false })
    expect(column(withTop(stateOfItems(items), { visibleStart: -3 })).canScrollUp).toBe(false)
  })
})

describe('columnView description and focus', () => {
  const described = (focusItemId: string | null): ReturnType<typeof column>['description'] => column(withTop(panelsState(), { focusItemId })).description

  it('describes the focused row', () => {
    expect(described('player-1')).toEqual({ text: 'license:0123abcd', disabled: false })
  })

  it('gives the reason of a disabled focused row', () => {
    expect(described('purge')).toEqual({ text: PURGE_ACTION.disabled?.reason, disabled: true })
  })

  it('has no description for a row without one, a section, the submit row or no focus', () => {
    expect(described('enabled')).toBeNull()
    expect(described('players')).toBeNull()
    expect(described(null)).toBeNull()
    expect(column(withTop(formState(), { focusItemId: FORM_SUBMIT_ROW_ID })).description).toBeNull()
  })

  it('points the active descendant at the focused rendered row', () => {
    expect(column().activeDescendant).toBe('omk-row-enabled')
    expect(column(withTop(formState(), { focusItemId: FORM_SUBMIT_ROW_ID })).activeDescendant).toBe(`omk-row-${FORM_SUBMIT_ROW_ID}`)
  })

  it('has no active descendant when covered, unfocused or out of the window', () => {
    expect(column(withTop(panelsState(), { layers: [COVER] })).activeDescendant).toBeNull()
    expect(column(withTop(panelsState(), { focusItemId: null })).activeDescendant).toBeNull()
    const far = withTop(stateOfItems(manyItems(MANY)), { visibleStart: 0, focusItemId: 'row-900' })
    expect(column(far).activeDescendant).toBeNull()
  })

  it('knows the item kind of the focused toggle', () => {
    expect(ENABLED_TOGGLE.kind).toBe(ItemKind.Toggle)
  })
})

describe('columnView output', () => {
  it('is deeply frozen and carries no function', () => {
    const view = column(withTop(formState(), { focusItemId: FORM_SUBMIT_ROW_ID }))
    expect(isDeeplyFrozen(view)).toBe(true)
    expect(hasFunction(view)).toBe(false)
  })
})
