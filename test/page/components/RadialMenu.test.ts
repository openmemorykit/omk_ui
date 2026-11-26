import { mount, type VueWrapper } from '@vue/test-utils'
import { shallowRef } from 'vue'
import { describe, expect, it, vi, type Mock } from 'vitest'
import type { Dispatch } from '../../../src/page/application/ports'
import RadialMenu from '../../../src/page/components/RadialMenu.vue'
import { UI_CONTEXT, type UiContext } from '../../../src/page/components/use-ui'
import { PageCommandType } from '../../../src/page/domain/page-commands'
import { pointerVector, sectorCenterAngle } from '../../../src/page/domain/radial-geometry'
import { createInitialState, RadialLevel } from '../../../src/page/domain/ui-state'
import { Intent, IntentPhase } from '../../../src/protocol/intents'
import { radialEntry, radialState, translate } from '../application/views/helpers'

const SECTORS = 6
const PARENT = 1
const THIRD = 2
const CHILD_COUNT = 3
const AIMED_CHILD = 2
const BOX = 848
const HALF_BOX = 424
const HOLE_OFFSET = 50
const RING_OFFSET = 200
const DOUBLE_SCALE = 2
const DOUBLE_BOX = BOX * DOUBLE_SCALE
const DOUBLE_OFFSET = RING_OFFSET * DOUBLE_SCALE
const ENTRIES = Array.from({ length: SECTORS }, (_unused, index) => radialEntry(`e${index}`, index === PARENT ? CHILD_COUNT : 0))

function mountRadial(state = radialState(ENTRIES), legend = ''): { wrapper: VueWrapper; dispatch: Mock<Dispatch> } {
  const dispatch = vi.fn<Dispatch>()
  const context: UiContext = { state: shallowRef(state), dispatch, translate, viewport: shallowRef({ width: 1920, height: 1080 }) }
  const wrapper = mount(RadialMenu, { global: { provide: { [UI_CONTEXT as symbol]: context } }, slots: { legend } })
  return { wrapper, dispatch }
}

const level2 = (childIndex: number | null = AIMED_CHILD): ReturnType<typeof radialState> =>
  radialState(ENTRIES, { sectorIndex: PARENT, level: RadialLevel.Children, childIndex })

function sizeBox(wrapper: VueWrapper, size: number = BOX): void {
  const rect = { left: 0, top: 0, right: size, bottom: size, width: size, height: size, x: 0, y: 0, toJSON: () => ({}) }
  const { element } = wrapper.get('[role="menu"]')
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect)
}

describe('RadialMenu', () => {
  it('renders nothing when the radial is closed', () => {
    const { wrapper } = mountRadial({ ...createInitialState() }, '<span id="legend">legend</span>')
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(wrapper.find('#legend').exists()).toBe(false)
  })

  it('draws one menu item per sector at level 1, the aimed one marked', () => {
    const { wrapper } = mountRadial()
    const items = wrapper.findAll('[role="menuitem"]')
    expect(items).toHaveLength(SECTORS)
    expect(items.map((item) => item.attributes('aria-label'))).toEqual(ENTRIES.map((owned) => owned.entry.label))
    expect(items.map((item) => item.classes().includes('is-aimed'))).toEqual(ENTRIES.map((_unused, index) => index === 0))
    expect(wrapper.find('.is-dimmed').exists()).toBe(false)
    expect(wrapper.find('.is-parent').exists()).toBe(false)
  })

  it('carries the two surfaces', () => {
    const { wrapper } = mountRadial()
    expect(wrapper.find('[data-surface="radial-ring"]').exists()).toBe(true)
    expect(wrapper.find('[data-surface="radial-center"]').exists()).toBe(true)
  })

  it('marks the parent and dims the other sectors at level 2', () => {
    const { wrapper } = mountRadial(level2())
    const sectors = wrapper.findAll('[role="menuitem"]:not(.is-sub)')
    expect(sectors.map((item) => item.classes().includes('is-parent'))).toEqual(ENTRIES.map((_unused, index) => index === PARENT))
    expect(sectors.map((item) => item.classes().includes('is-dimmed'))).toEqual(ENTRIES.map((_unused, index) => index !== PARENT))
    expect(sectors.some((item) => item.classes().includes('is-aimed'))).toBe(false)
    expect(wrapper.findAll('.is-dimmed .omk-radial__veil')).toHaveLength(SECTORS - 1)
    expect(wrapper.findAll('.is-parent .omk-radial__edge')).toHaveLength(1)
  })

  it('draws the leaves in the sub-ring at level 2 with the aimed one marked', () => {
    const { wrapper } = mountRadial(level2())
    const leaves = wrapper.findAll('[role="menuitem"].is-sub')
    expect(leaves).toHaveLength(CHILD_COUNT)
    expect(leaves.map((leaf) => leaf.classes().includes('is-aimed'))).toEqual([false, false, true])
  })

  it('draws no sub-ring at level 1', () => {
    expect(mountRadial().wrapper.find('.is-sub').exists()).toBe(false)
  })

  it('points the needle at the aimed sector by a transform rotation', () => {
    const angle = sectorCenterAngle(THIRD, SECTORS)
    const { wrapper } = mountRadial(radialState(ENTRIES, { sectorIndex: THIRD }))
    expect(wrapper.get('.omk-radial__needle').attributes('transform')).toContain(`rotate(${angle})`)
  })

  it('points the needle at the aimed leaf at level 2', () => {
    const { wrapper } = mountRadial(level2(0))
    const sector = wrapper.get('.omk-radial__needle').attributes('transform')
    expect(sector).toContain('rotate(')
    expect(sector).not.toContain(`rotate(${sectorCenterAngle(PARENT, SECTORS)})`)
  })

  it('shows the name, description and icon of the aimed sector in the center', () => {
    const { wrapper } = mountRadial()
    const center = wrapper.get('[data-surface="radial-center"]')
    expect(center.text()).toContain('Entry e0')
    expect(center.text()).toContain('About e0')
    expect(center.find('svg path').exists()).toBe(true)
    expect(center.find('.omk-radial__path').exists()).toBe(false)
  })

  it('shows the path to the aimed leaf in the center at level 2', () => {
    const { wrapper } = mountRadial(level2())
    const center = wrapper.get('[data-surface="radial-center"]')
    expect(center.text()).toContain('Leaf e1-c2')
    expect(center.get('.omk-radial__path').text()).toBe('Entry e1 · Leaf e1-c2')
  })

  it('puts the legend slot above the menu', () => {
    const { wrapper } = mountRadial(radialState(ENTRIES), '<span id="legend">legend</span>')
    expect(wrapper.get('#legend').text()).toBe('legend')
    expect(wrapper.get('[role="menu"]').find('#legend').exists()).toBe(false)
  })

  it('confirms with exactly one press then one release on a click', async () => {
    const { wrapper, dispatch } = mountRadial()
    await wrapper.get('[role="menu"]').trigger('click')
    expect(dispatch.mock.calls.map(([command]) => command)).toEqual([
      { type: PageCommandType.LocalIntent, intent: Intent.Confirm, phase: IntentPhase.Press, fromEscape: false },
      { type: PageCommandType.LocalIntent, intent: Intent.Confirm, phase: IntentPhase.Release, fromEscape: false },
    ])
  })

  it('aims with the domain vector when the pointer moves over the ring', async () => {
    const { wrapper, dispatch } = mountRadial()
    sizeBox(wrapper)
    await wrapper.get('[role="menu"]').trigger('pointermove', { clientX: HALF_BOX + RING_OFFSET, clientY: HALF_BOX })
    const vector = pointerVector({ x: HALF_BOX + RING_OFFSET, y: HALF_BOX }, { x: HALF_BOX, y: HALF_BOX }, 1)
    expect(vector).not.toBeNull()
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ type: PageCommandType.PointerAim, vector })
  })

  it('aims at nothing when the pointer is in the central hole', async () => {
    const { wrapper, dispatch } = mountRadial()
    sizeBox(wrapper)
    await wrapper.get('[role="menu"]').trigger('pointermove', { clientX: HALF_BOX + HOLE_OFFSET, clientY: HALF_BOX })
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ type: PageCommandType.PointerAim, vector: null })
  })

  it('scales the pointer vector with the rendered size', async () => {
    const { wrapper, dispatch } = mountRadial()
    sizeBox(wrapper, DOUBLE_BOX)
    await wrapper.get('[role="menu"]').trigger('pointermove', { clientX: BOX + DOUBLE_OFFSET, clientY: BOX })
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({
      type: PageCommandType.PointerAim,
      vector: pointerVector({ x: BOX + DOUBLE_OFFSET, y: BOX }, { x: BOX, y: BOX }, DOUBLE_SCALE),
    })
  })
})
