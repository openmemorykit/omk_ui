import { mount, type VueWrapper } from '@vue/test-utils'
import { PromptMode } from '@openmemorykit/ui/contract'
import { shallowRef } from 'vue'
import { describe, expect, it } from 'vitest'
import HoldPrompt from '../../../src/page/components/HoldPrompt.vue'
import { UI_CONTEXT } from '../../../src/page/components/use-ui'
import { createInitialState, type UiState } from '../../../src/page/domain/ui-state'
import { Modality } from '../../../src/protocol/intents'
import { PromptState } from '../../../src/protocol/page-vocabulary'
import { prompt, translate } from '../application/views/helpers'
import { REDUCED_MOTION_CUT_SELECTOR } from '../theme/reduced-motion'

const HOLD_MS = 1_500
const VIEWPORT = { width: 1920, height: 1080 }

function stateWith(mode: PromptMode, state: PromptState | null, overrides: Partial<UiState> = {}): UiState {
  return { ...createInitialState(), prompt: { prompt: prompt(mode, HOLD_MS), state, holdMs: HOLD_MS }, ...overrides }
}

function render(state: UiState): VueWrapper {
  const context = { state: shallowRef(state), dispatch: (): void => undefined, translate, viewport: shallowRef(VIEWPORT) }
  return mount(HoldPrompt, { global: { provide: { [UI_CONTEXT as symbol]: context } } })
}

describe('HoldPrompt', () => {
  it('renders nothing without a prompt', () => {
    expect(render(createInitialState()).find('[data-surface="prompt"]').exists()).toBe(false)
  })

  it('shows a simple prompt with its glyph and label, without hold word or ring', () => {
    const wrapper = render(stateWith(PromptMode.Press, null))
    const surface = wrapper.get('[data-surface="prompt"]')
    expect(surface.text()).toContain('Open door')
    expect(surface.text()).not.toContain('t:ui.prompt.hold')
    expect(surface.find('.omk-prompt__ring').exists()).toBe(false)
    expect(surface.find('[role="img"]').exists()).toBe(true)
  })

  it('shows the translated hold word and an idle ring for a hold prompt', () => {
    const surface = render(stateWith(PromptMode.Hold, null)).get('[data-surface="prompt"]')
    expect(surface.text()).toContain('t:ui.prompt.hold')
    expect(surface.get('.omk-prompt__ring').attributes('data-state')).toBe('idle')
  })

  it('animates the ring over the hold duration while holding, without any other message', () => {
    const ring = render(stateWith(PromptMode.Hold, PromptState.Holding)).get('.omk-prompt__ring')
    expect(ring.attributes('data-state')).toBe(PromptState.Holding)
    expect(ring.attributes('data-motion')).toBe('essential')
    expect(ring.attributes('style')).toContain(`--ring-ms: ${HOLD_MS}ms`)
  })

  it('keeps the ring arcs out of the reduced-motion cut', () => {
    const arcs = render(stateWith(PromptMode.Hold, PromptState.Holding)).findAll('.omk-prompt__arc')
    expect(arcs).toHaveLength(2)
    for (const arc of arcs) expect(arc.element.matches(REDUCED_MOTION_CUT_SELECTOR)).toBe(false)
  })

  it('shows the cancelled ring', () => {
    const ring = render(stateWith(PromptMode.Hold, PromptState.Cancelled)).get('.omk-prompt__ring')
    expect(ring.attributes('data-state')).toBe(PromptState.Cancelled)
  })

  it('shows the completed ring', () => {
    const ring = render(stateWith(PromptMode.Hold, PromptState.Completed)).get('.omk-prompt__ring')
    expect(ring.attributes('data-state')).toBe(PromptState.Completed)
  })

  it('uses the bound key on the keyboard and the pad glyph on a gamepad', () => {
    const bound = { radial: '', interact: 'F', pushToTalk: '' }
    expect(render(stateWith(PromptMode.Press, null, { binding: bound })).get('[role="img"]').text()).toBe('F')
    const pad = render(stateWith(PromptMode.Press, null, { modality: Modality.Gamepad })).get('[role="img"]')
    expect(pad.attributes('aria-label')).toBe('t:ui.glyph.pad.dpad')
    expect(pad.classes()).toContain('omk-pad')
  })

  it('anchors the prompt against the column side', () => {
    const base = stateWith(PromptMode.Press, null)
    const left = { ...base, settings: { ...base.settings, side: 'right' as const } }
    expect(render(base).attributes('data-column-side')).toBe('left')
    expect(render(left).attributes('data-column-side')).toBe('right')
  })
})
