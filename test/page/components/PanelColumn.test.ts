import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RowView } from '../../../src/page/application/views/row-view'
import FormSubmitRow from '../../../src/page/components/FormSubmitRow.vue'
import ItemRow from '../../../src/page/components/ItemRow.vue'
import PanelColumn from '../../../src/page/components/PanelColumn.vue'
import { openPanelFrame } from '../../../src/page/domain/navigation'
import { OWNED_LIST_PANEL } from '../../fixtures/owned'
import { ConfirmChoice, ConfirmOrigin, LayerKind, createInitialState } from '../../../src/page/domain/ui-state'
import { PanelSide } from '../../../src/shared/config/config-schema'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import columnSource from '../../../src/page/components/PanelColumn.vue?raw'
import { formState, manyItems, panelsState, pushedState, stateOfItems, translate, withTop } from '../application/views/column-fixtures'
import { mountWithUi, type Harness } from './fixtures/ui-harness'

const COVER = { kind: LayerKind.Confirm, origin: ConfirmOrigin.Request, content: { title: 'T', text: 'X', confirmLabel: 'Go' }, confirmId: null, itemId: null, choice: ConfirmChoice.Cancel } as const
const MANY = 40
const SPACERS = 2
const HIDDEN = 'true'
const DEEP_START = 15
const WINDOW_START = 5

type State = ReturnType<typeof panelsState>

function mountColumn(state: State = panelsState(), slots: Record<string, string> = {}): Harness {
  return mountWithUi(PanelColumn, { state, slots, translate })
}

async function show(harness: Harness, state: State): Promise<void> {
  const { state: current } = harness.context
  current.value = state
  await nextTick()
}

function optionIds(harness: Harness): readonly (string | undefined)[] {
  return harness.wrapper.findAll('[role="option"]').map((option) => option.attributes('id'))
}

describe('PanelColumn surface', () => {
  it('renders nothing without a column to show', () => {
    expect(mountColumn(createInitialState()).wrapper.find('[data-surface]').exists()).toBe(false)
  })

  it('is one opaque column surface', () => {
    const { wrapper } = mountColumn()
    const root = wrapper.find('[data-surface="column"]')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toEqual(expect.arrayContaining(['omk-surface-deep', 'omk-surface-lifted']))
    expect(root.attributes('style') ?? '').not.toMatch(/opacity|filter/)
    expect(wrapper.findAll('[data-surface]')).toHaveLength(1)
  })

  it('stays on the configured side', async () => {
    const harness = mountColumn()
    expect(harness.wrapper.find('[data-surface="column"]').attributes('data-side')).toBe(PanelSide.Left)
    const state = panelsState()
    await show(harness, { ...state, settings: { ...state.settings, side: PanelSide.Right } })
    expect(harness.wrapper.find('[data-surface="column"]').attributes('data-side')).toBe(PanelSide.Right)
  })

  it('is dimmed by the veil attribute when the radial is open, never by opacity', async () => {
    const harness = mountColumn()
    expect(harness.wrapper.find('[data-surface="column"]').attributes('data-dimmed')).toBeUndefined()
    await show(harness, { ...panelsState(), mode: UiMode.Radial })
    const root = harness.wrapper.find('[data-surface="column"]')
    expect(root.attributes('data-dimmed')).toBeDefined()
    expect(root.attributes('style') ?? '').not.toMatch(/opacity/)
  })
})

describe('PanelColumn banner and trail', () => {
  it('shows the default monogram, the title and the subtitle', () => {
    const { wrapper } = mountColumn()
    expect(wrapper.find('.omk-monogram').text()).toBe('O')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.omk-title').text()).toBe('Whitelist')
    expect(wrapper.find('.omk-banner__subtitle').text()).toBe('Page 1 of 1')
  })

  it('shows the logo in place of the monogram', () => {
    const state = panelsState()
    const { wrapper } = mountColumn({ ...state, settings: { ...state.settings, logo: 'nui://res/logo.png' } })
    expect(wrapper.find('img.omk-logo').attributes('src')).toBe('nui://res/logo.png')
    expect(wrapper.find('.omk-monogram').exists()).toBe(false)
  })

  it('shows the configured monogram', () => {
    const state = panelsState()
    expect(mountColumn({ ...state, settings: { ...state.settings, monogram: 'K' } }).wrapper.find('.omk-monogram').text()).toBe('K')
  })

  it('has no subtitle element without a subtitle', () => {
    expect(mountColumn(formState()).wrapper.find('.omk-banner__subtitle').exists()).toBe(false)
  })

  it('shows one current crumb at the root', () => {
    const crumbs = mountColumn().wrapper.findAll('.omk-crumbs__crumb')
    expect(crumbs.map((crumb) => crumb.text())).toEqual(['Whitelist'])
    expect(crumbs[0]?.classes()).toContain('is-current')
  })

  it('shows the levels with chevrons and the last one current', () => {
    const { wrapper } = mountColumn(pushedState(panelsState()))
    const crumbs = wrapper.findAll('.omk-crumbs__crumb')
    expect(crumbs.map((crumb) => crumb.text())).toEqual(['Whitelist', 'Whitelist'])
    expect(crumbs.map((crumb) => crumb.classes().includes('is-current'))).toEqual([false, true])
    expect(wrapper.findAll('.omk-crumbs svg.omk-icon')).toHaveLength(1)
  })
})

describe('PanelColumn rows', () => {
  it('is a listbox pointing at the focused row', () => {
    const { wrapper } = mountColumn()
    const list = wrapper.find('[role="listbox"]')
    expect(list.exists()).toBe(true)
    expect(list.attributes('aria-activedescendant')).toBe('omk-row-enabled')
    expect(list.attributes('aria-label')).toBe('Whitelist')
  })

  it('has no active descendant under a layer', () => {
    const state = withTop(panelsState(), { layers: [COVER] })
    expect(mountColumn(state).wrapper.find('[role="listbox"]').attributes('aria-activedescendant')).toBeUndefined()
  })

  it('renders one ItemRow per row in order, sections without an option', () => {
    const { wrapper } = mountColumn()
    expect(wrapper.findAllComponents(ItemRow).map((row) => (row.props('row') as RowView).id)).toEqual(['enabled', 'add', 'players', 'player-1', 'count', 'purge', 'remove-all'])
    expect(optionIds({ wrapper } as Harness)).toEqual(['enabled', 'add', 'player-1', 'count', 'purge', 'remove-all'].map((id) => `omk-row-${id}`))
  })

  it('renders the submit row of a form last', () => {
    const { wrapper } = mountColumn(formState())
    expect(wrapper.findAllComponents(FormSubmitRow)).toHaveLength(1)
    const ids = optionIds({ wrapper } as Harness)
    expect(ids[ids.length - 1]).toBe('omk-row-__submit')
  })

  it('keeps the rows of the same item when the focus moves', async () => {
    const harness = mountColumn()
    const before = harness.wrapper.find('#omk-row-add').element
    await show(harness, withTop(panelsState(), { focusItemId: 'add' }))
    expect(harness.wrapper.find('#omk-row-add').element).toBe(before)
    expect(harness.wrapper.find('[role="listbox"]').attributes('aria-activedescendant')).toBe('omk-row-add')
    expect(harness.wrapper.find('#omk-row-add .omk-row').classes()).toContain('is-focused')
  })

  it('shows the empty text when there is no row', () => {
    const owned = { ...OWNED_LIST_PANEL, panel: { ...OWNED_LIST_PANEL.panel, items: [] } }
    const empty = { ...openPanelFrame(createInitialState(), owned, 1).state, mode: UiMode.Panels }
    const { wrapper } = mountColumn(empty)
    expect(wrapper.find('.omk-column__empty').text()).toBe('No player yet')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
  })

  it('has no empty text when rows exist', () => {
    expect(mountColumn().wrapper.find('.omk-column__empty').exists()).toBe(false)
  })

  it('renders only the window of a long list between two spacers of the full height', () => {
    const state = withTop(stateOfItems(manyItems(MANY)), { visibleStart: DEEP_START, focusItemId: 'row-20' })
    const { wrapper } = mountColumn(state)
    const first = wrapper.find('[role="option"]').attributes('id')
    expect(first).toBe(`omk-row-row-${String(WINDOW_START)}`)
    const spacers = wrapper.findAll('.omk-rows__spacer')
    expect(spacers).toHaveLength(SPACERS)
    expect(spacers[0]?.attributes('style')).toContain(`calc(${String(WINDOW_START)} * var(--row-height))`)
    const rendered = wrapper.findAll('[role="option"]').length
    expect(spacers[1]?.attributes('style')).toContain(`calc(${String(MANY - WINDOW_START - rendered)} * var(--row-height))`)
    expect(spacers.every((spacer) => spacer.attributes('aria-hidden') === HIDDEN)).toBe(true)
  })

  it('keeps the focused row in view by asking for the nearest scroll', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
    const harness = mountColumn(withTop(stateOfItems(manyItems(MANY)), { focusItemId: 'row-0' }))
    await nextTick()
    scrollIntoView.mockClear()
    await show(harness, withTop(stateOfItems(manyItems(MANY)), { focusItemId: 'row-9' }))
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    expect((scrollIntoView.mock.contexts[0] as Element).id).toBe('omk-row-row-9')
  })
})

describe('PanelColumn foot and description', () => {
  it('shows the position over the total with the scroll arrows', () => {
    const { wrapper } = mountColumn()
    expect(wrapper.find('.omk-foot__count').text()).toBe('1')
    expect(wrapper.find('.omk-foot__total').text()).toBe('/ 5')
    expect(wrapper.find('.omk-foot__position').text()).toBe('1 / 5')
    expect(wrapper.findAll('.omk-foot__arrow').map((arrow) => arrow.classes().includes('is-on'))).toEqual([false, false])
  })

  it('lights the arrow of a direction that has rows left', () => {
    const state = withTop(stateOfItems(manyItems(MANY)), { visibleStart: DEEP_START, focusItemId: 'row-20' })
    expect(mountColumn(state).wrapper.findAll('.omk-foot__arrow').map((arrow) => arrow.classes().includes('is-on'))).toEqual([true, true])
    const top = withTop(stateOfItems(manyItems(MANY)), { visibleStart: 0, focusItemId: 'row-0' })
    expect(mountColumn(top).wrapper.findAll('.omk-foot__arrow').map((arrow) => arrow.classes().includes('is-on'))).toEqual([false, true])
  })

  it('shows no counter without a focusable row but keeps the foot', () => {
    const { wrapper } = mountColumn(stateOfItems([]))
    expect(wrapper.find('.omk-foot').exists()).toBe(true)
    expect(wrapper.find('.omk-foot__count').exists()).toBe(false)
  })

  it('shows the description of the focused row', async () => {
    const harness = mountColumn()
    expect(harness.wrapper.find('.omk-description').exists()).toBe(false)
    await show(harness, withTop(panelsState(), { focusItemId: 'player-1' }))
    expect(harness.wrapper.find('.omk-description').text()).toBe('license:0123abcd')
    expect(harness.wrapper.find('.omk-description svg.omk-icon').exists()).toBe(true)
  })
})

describe('PanelColumn slots', () => {
  it('has no layer while no layer covers the rows', () => {
    const { wrapper } = mountColumn(panelsState(), { layer: '<p id="layer">Layer</p>' })
    expect(wrapper.find('#layer').exists()).toBe(false)
  })

  it('shows the layer slot over the rows and the foot when covered, banner kept', () => {
    const { wrapper } = mountColumn(withTop(panelsState(), { layers: [COVER] }), { layer: '<p id="layer">Layer</p>' })
    const layer = wrapper.find('.omk-column__layer')
    expect(layer.find('#layer').exists()).toBe(true)
    expect(layer.element.parentElement?.classList.contains('omk-column__body')).toBe(true)
    expect(wrapper.find('.omk-column__body').find('[role="listbox"]').exists()).toBe(true)
    expect(wrapper.find('.omk-column__body').find('.omk-foot').exists()).toBe(true)
    expect(wrapper.find('.omk-column__body').find('.omk-banner').exists()).toBe(false)
    expect(wrapper.find('.omk-banner').exists()).toBe(true)
  })

  it('shows the legend slot at the bottom', () => {
    const { wrapper } = mountColumn(panelsState(), { legend: '<p id="legend">Legend</p>' })
    expect(wrapper.find('#legend').exists()).toBe(true)
    const children = [...(wrapper.find('[data-surface="column"]').element.children)]
    expect(children[children.length - 1]?.contains(wrapper.find('#legend').element)).toBe(true)
  })

  it('has no legend block without a legend slot', () => {
    expect(mountColumn().wrapper.find('.omk-column__legend').exists()).toBe(false)
  })
})

describe('PanelColumn stacking animation', () => {
  const originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')

  beforeEach(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  })

  afterEach(() => {
    if (originalScroll === undefined) Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    else Object.defineProperty(Element.prototype, 'scrollIntoView', originalScroll)
  })

  it('pushes the rows of a deeper level and pops back', async () => {
    const harness = mountColumn()
    const root = harness.wrapper.find('[role="listbox"]').element
    expect(harness.wrapper.find('[role="listbox"]').classes()).toContain('omk-anim-push')
    await show(harness, pushedState(panelsState()))
    const deeper = harness.wrapper.find('[role="listbox"]')
    expect(deeper.element).not.toBe(root)
    expect(deeper.classes()).toContain('omk-anim-push')
    await show(harness, panelsState())
    expect(harness.wrapper.find('[role="listbox"]').classes()).toContain('omk-anim-pop')
    expect(harness.wrapper.find('[role="listbox"]').classes()).not.toContain('omk-anim-push')
  })
})

describe('PanelColumn layout contract', () => {
  it('fixes the list to ten rows and contains its layout and paint', () => {
    expect(columnSource).toMatch(/height:\s*calc\(var\(--visible-rows\)\s*\*\s*var\(--row-height\)\s*\+\s*var\(--space-3\)\)/)
    expect(columnSource).toMatch(/contain:\s*layout paint/)
    expect(columnSource).toMatch(/width:\s*var\(--column-width\)/)
  })

  it('uses no opacity, filter or gradient of its own', () => {
    expect(columnSource).not.toMatch(/opacity|backdrop-filter|filter:|gradient\(/)
  })
})
