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
const NOTHING_HELD = 0
const QUARTER_HELD = 0.25
const HALF_HELD = 0.5
const SIXTY_TWO_HELD = 0.62
const WHOLE_HELD = 1
const RIGHT_EMPTY = -135
const RIGHT_FULL = 45
const LEFT_EMPTY = 45
const LEFT_AT_SIXTY_TWO = 88.2
const LEFT_FULL = 225
const QUARTER_TURN = 90

function stateWith(mode: PromptMode, state: PromptState | null, holdMs?: number, overrides: Partial<UiState> = {}, heldFraction = 0): UiState {
  return { ...createInitialState(), prompt: { prompt: prompt(mode, holdMs), state, holdMs: holdMs ?? 0, holdStartedAt: null, heldFraction }, ...overrides }
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

  it('carries the translated hold label', () => {
    expect(promptView(stateWith(PromptMode.Hold, null, HOLD_MS), translate)?.holdLabel).toBe('t:ui.prompt.hold')
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

  it.each([
    [NOTHING_HELD, RIGHT_EMPTY, LEFT_EMPTY],
    [QUARTER_HELD, RIGHT_EMPTY + QUARTER_TURN, LEFT_EMPTY],
    [HALF_HELD, RIGHT_FULL, LEFT_EMPTY],
    [SIXTY_TWO_HELD, RIGHT_FULL, LEFT_AT_SIXTY_TWO],
    [WHOLE_HELD, RIGHT_FULL, LEFT_FULL],
  ])('starts the recede of a ring cancelled at %s of the hold from %s and %s degrees', (heldFraction, right, left) => {
    const view = promptView(stateWith(PromptMode.Hold, PromptState.Cancelled, HOLD_MS, {}, heldFraction), translate)
    expect(view?.ringFrom.right).toBeCloseTo(right)
    expect(view?.ringFrom.left).toBeCloseTo(left)
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
