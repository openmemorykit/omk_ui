import { PROMPT_HOLD_DEFAULT_MS, PromptMode } from '@openmemorykit/ui/contract'
import { Modality } from '../../../protocol/intents'
import { PromptState } from '../../../protocol/page-vocabulary'
import { PadGlyph } from '../../domain/legend'
import type { UiState } from '../../domain/ui-state'
import type { Translate } from '../../i18n/messages'
import { BINDING_GLYPH, type GlyphName } from '../../theme/glyph-view'

export const PROMPT_CANCEL_MS = 80
export const PROMPT_SUCCESS_MS = 300
export const DEFAULT_INTERACT_KEY = 'E'

export interface PromptGlyphView {
  readonly glyph: GlyphName
  readonly label: string
}

export interface RingAngles {
  readonly right: number
  readonly left: number
}

export interface HoldPromptView {
  readonly id: string
  readonly label: string
  readonly hold: boolean
  readonly holdLabel: string
  readonly holdMs: number
  readonly state: PromptState | null
  readonly ringMs: number
  readonly ringFrom: RingAngles
  readonly glyph: PromptGlyphView
}

const NO_RING = 0
const HALVES = 2
const HALF_TURN = 180
const RIGHT_ARC_EMPTY = -135
const LEFT_ARC_EMPTY = 45

const DEGREE_PRECISION = 100

function roundedDegrees(degrees: number): number {
  return Math.round(degrees * DEGREE_PRECISION) / DEGREE_PRECISION
}

function ringFrom(heldFraction: number): RingAngles {
  const rightShare = Math.min(heldFraction * HALVES, 1)
  const leftShare = Math.max(heldFraction * HALVES - 1, NO_RING)
  return { right: roundedDegrees(RIGHT_ARC_EMPTY + HALF_TURN * rightShare), left: roundedDegrees(LEFT_ARC_EMPTY + HALF_TURN * leftShare) }
}

function ringMs(state: PromptState | null, holdMs: number): number {
  switch (state) {
    case PromptState.Holding:
      return holdMs
    case PromptState.Cancelled:
      return PROMPT_CANCEL_MS
    case PromptState.Completed:
      return PROMPT_SUCCESS_MS
    default:
      return NO_RING
  }
}

function glyphOf(state: UiState, translate: Translate): PromptGlyphView {
  if (state.modality === Modality.Gamepad) return { glyph: PadGlyph.Dpad, label: translate('ui.glyph.pad.dpad') }
  const bound = state.binding.interact
  return { glyph: BINDING_GLYPH, label: bound.length > 0 ? bound : DEFAULT_INTERACT_KEY }
}

export function promptView(state: UiState, translate: Translate): HoldPromptView | null {
  if (state.prompt === null) return null
  const { prompt, state: progress } = state.prompt
  const holdMs = prompt.prompt.holdMs ?? PROMPT_HOLD_DEFAULT_MS
  return {
    id: prompt.prompt.id,
    label: prompt.prompt.label,
    hold: prompt.prompt.mode === PromptMode.Hold,
    holdLabel: translate('ui.prompt.hold'),
    holdMs,
    state: progress,
    ringMs: ringMs(progress, state.prompt.holdMs > NO_RING ? state.prompt.holdMs : holdMs),
    ringFrom: ringFrom(state.prompt.heldFraction),
    glyph: glyphOf(state, translate),
  }
}
