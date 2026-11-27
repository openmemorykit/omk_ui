import { mount, type VueWrapper } from '@vue/test-utils'
import { shallowRef } from 'vue'
import { describe, expect, it } from 'vitest'
import KeyLegend from '../../../src/page/components/KeyLegend.vue'
import { UI_CONTEXT } from '../../../src/page/components/use-ui'
import { LegendAction } from '../../../src/page/domain/legend'
import { createInitialState, type UiState } from '../../../src/page/domain/ui-state'
import { Modality } from '../../../src/protocol/intents'
import { GlyphSet } from '../../../src/protocol/page-vocabulary'
import { ItemKind } from '@openmemorykit/ui/contract'
import { itemOf, KEYBOARD_LAYER, panelsState, radialEntry, radialState, translate } from '../application/views/helpers'

const VIEWPORT = { width: 1920, height: 1080 }

function render(state: UiState): VueWrapper {
  const context = { state: shallowRef(state), dispatch: (): void => undefined, translate, viewport: shallowRef(VIEWPORT) }
  return mount(KeyLegend, { global: { provide: { [UI_CONTEXT as symbol]: context } } })
}

const radial = (overrides: Partial<UiState> = {}): UiState => ({ ...radialState([radialEntry('a')]), ...overrides })

const BACK_GLYPHS = 2

describe('KeyLegend', () => {
  it('renders nothing when the view has no legend', () => {
    expect(render(createInitialState()).find('[data-surface="legend"]').exists()).toBe(false)
  })

  it('lists each action with its translated label', () => {
    const wrapper = render(radial())
    expect(wrapper.get('[data-surface="legend"]').attributes('data-modality')).toBe(Modality.KeyboardMouse)
    expect(wrapper.text()).toContain(`t:ui.legend.${LegendAction.Aim}`)
    expect(wrapper.text()).toContain(`t:ui.legend.${LegendAction.Close}`)
  })

  it('draws keyboard and Xbox glyphs, the keyboard ones active on keyboard and mouse', () => {
    const wrapper = render(radial({ glyphSet: GlyphSet.Xbox }))
    expect(wrapper.findAll('.omk-keycap').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.omk-pad').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.omk-keycap.is-muted')).toHaveLength(0)
    expect(wrapper.findAll('.omk-pad.is-muted')).toHaveLength(wrapper.findAll('.omk-pad').length)
  })

  it('mutes the keyboard glyphs on a gamepad', () => {
    const wrapper = render(radial({ modality: Modality.Gamepad }))
    expect(wrapper.findAll('.omk-pad.is-muted')).toHaveLength(0)
    expect(wrapper.findAll('.omk-keycap.is-muted')).toHaveLength(wrapper.findAll('.omk-keycap').length)
    expect(wrapper.get('[data-surface="legend"]').attributes('data-modality')).toBe(Modality.Gamepad)
  })

  it('draws the PlayStation shoulders by their set names', () => {
    const state = { ...panelsState([], null, [KEYBOARD_LAYER]), glyphSet: GlyphSet.PlayStation, modality: Modality.Gamepad }
    const text = render(state).text()
    expect(text).toContain('L1')
    expect(text).toContain('R1')
    expect(text).not.toContain('LB')
  })

  it('reads the label of each glyph from the view', () => {
    const wrapper = render(radial())
    const labels = wrapper.findAll('[role="img"]').map((glyph) => glyph.attributes('aria-label'))
    expect(labels).toContain('t:ui.glyph.pad.leftStick')
  })

  it('shows escape and B once, with back and, after the hold word, close all', () => {
    const item = { ...itemOf(ItemKind.Action), id: 'focused' }
    const wrapper = render(panelsState([item], 'focused'))
    const holds = wrapper.findAll('[data-hold="true"]')
    expect(holds).toHaveLength(1)
    expect(holds[0]?.text()).toContain(`t:ui.legend.${LegendAction.Back}`)
    expect(holds[0]?.text()).toContain('t:ui.prompt.hold')
    expect(holds[0]?.text()).toContain(`t:ui.legend.${LegendAction.CloseAll}`)
    expect(holds[0]?.findAll('[role="img"]')).toHaveLength(BACK_GLYPHS)
    expect(wrapper.findAll('[data-hold="false"] .omk-legend__hold')).toHaveLength(0)
  })
})
