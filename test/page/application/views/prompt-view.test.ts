import { describe, expect, it } from 'vitest'
import { PROMPT_HOLD_DEFAULT_MS, PromptMode } from '@openmemorykit/ui/contract'
import { PROMPT_CANCEL_MS, PROMPT_SUCCESS_MS, promptView } from '../../../../src/page/application/views/prompt-view'
import { BINDING_GLYPH } from '../../../../src/page/theme/glyph-view'
import { PadGlyph } from '../../../../src/page/domain/legend'
import { createInitialState, type UiState } from '../../../../src/page/domain/ui-state'
import { Modality } from '../../../../src/protocol/intents'
import { PromptState } from '../../../../src/protocol/page-vocabulary'
import { prompt, translate } from './helpers'

const HOLD_MS = 1_500
const CANCEL_MS = 80
const SUCCESS_MS = 300

function stateWith(mode: PromptMode, state: PromptState | null, holdMs?: number, overrides: Partial<UiState> = {}): UiState {
  return { ...createInitialState(), prompt: { prompt: prompt(mode, holdMs), state, holdMs: holdMs ?? 0 }, ...overrides }
}

describe('promptView', () => {
  it('is null without a prompt', () => {
    expect(promptView(createInitialState(), translate)).toBeNull()
  })

  it('describes a simple prompt', () => {
    const view = promptView(stateWith(PromptMode.Press, null), translate)
    expect(view).toMatchObject({ id: 'res/open', label: 'Open door', hold: false, state: null, ringMs: 0 })
  })

  it('describes a hold prompt waiting for the player', () => {
    const view = promptView(stateWith(PromptMode.Hold, null, HOLD_MS), translate)
    expect(view).toMatchObject({ hold: true, state: null, ringMs: 0, holdMs: HOLD_MS })
  })

  it('uses the default hold duration when the prompt gives none', () => {
    expect(promptView(stateWith(PromptMode.Hold, null), translate)?.holdMs).toBe(PROMPT_HOLD_DEFAULT_MS)
  })

  it('animates the ring over the hold duration while holding', () => {
    const view = promptView(stateWith(PromptMode.Hold, PromptState.Holding, HOLD_MS), translate)
    expect(view).toMatchObject({ state: PromptState.Holding, ringMs: HOLD_MS })
  })

  it('empties the ring in 80 ms when cancelled', () => {
    const view = promptView(stateWith(PromptMode.Hold, PromptState.Cancelled, HOLD_MS), translate)
    expect(view).toMatchObject({ state: PromptState.Cancelled, ringMs: PROMPT_CANCEL_MS })
    expect(PROMPT_CANCEL_MS).toBe(CANCEL_MS)
  })

  it('turns the ring to the success tone over 300 ms when completed', () => {
    const view = promptView(stateWith(PromptMode.Hold, PromptState.Completed, HOLD_MS), translate)
    expect(view).toMatchObject({ state: PromptState.Completed, ringMs: PROMPT_SUCCESS_MS })
    expect(PROMPT_SUCCESS_MS).toBe(SUCCESS_MS)
  })

  it('shows the bound interact key on keyboard and mouse', () => {
    const state = stateWith(PromptMode.Press, null, undefined, { binding: { radial: '', interact: 'G', pushToTalk: '' } })
    expect(promptView(state, translate)?.glyph).toEqual({ glyph: BINDING_GLYPH, label: 'G' })
  })

  it('falls back on the E key when no interact key is bound', () => {
    expect(promptView(stateWith(PromptMode.Press, null), translate)?.glyph).toEqual({ glyph: BINDING_GLYPH, label: 'E' })
  })

  it('shows the right d-pad on a gamepad', () => {
    const state = stateWith(PromptMode.Press, null, undefined, { modality: Modality.Gamepad })
    expect(promptView(state, translate)?.glyph).toEqual({ glyph: PadGlyph.Dpad, label: 't:ui.glyph.pad.dpad' })
  })
})
