import { ItemKind } from '@openmemorykit/ui/contract'
import type { ValueOf } from '@openmemorykit/core/shared'
import { Modality } from '../../../protocol/intents'
import { GlyphSet, UiMode } from '../../../protocol/page-vocabulary'
import { topFrameOf, topLayerOf } from '../../domain/frame-updates'
import {
  KeyGlyph,
  legendEntries,
  LegendContextKind,
  type LegendAction,
  type LegendContext,
  type PadGlyph,
} from '../../domain/legend'
import { isSubmitRow, focusableItem } from '../../domain/panel-rows'
import { LayerKind, type Frame, type UiState } from '../../domain/ui-state'
import type { Translate } from '../../i18n/messages'
import { BINDING_GLYPH, type GlyphName } from '../../theme/glyph-view'

export interface LegendGlyphView {
  readonly glyph: GlyphName
  readonly label: string
  readonly muted: boolean
}

export interface LegendEntryView {
  readonly action: ValueOf<typeof LegendAction>
  readonly label: string
  readonly hold: boolean
  readonly keys: readonly LegendGlyphView[]
  readonly pad: readonly LegendGlyphView[]
}

export interface LegendView {
  readonly glyphSet: GlyphSet
  readonly modality: Modality
  readonly entries: readonly LegendEntryView[]
}

const NO_FOCUS = { focusedKind: null, focusedDisabled: false } as const

function listContext(frame: Frame): LegendContext {
  const panel = frame.panel?.panel
  const base = { kind: LegendContextKind.List }
  if (panel === undefined) return { ...base, ...NO_FOCUS }
  if (isSubmitRow(panel, frame.focusItemId)) return { ...base, focusedKind: ItemKind.Action, focusedDisabled: false }
  const item = focusableItem(panel, frame.focusItemId)
  if (item === undefined) return { ...base, ...NO_FOCUS }
  return { ...base, focusedKind: item.kind, focusedDisabled: item.kind !== ItemKind.Section && item.disabled !== undefined }
}

function panelsContext(frame: Frame): LegendContext {
  const layer = topLayerOf(frame)
  if (layer === undefined) return listContext(frame)
  const kind = layer.kind === LayerKind.Keyboard ? LegendContextKind.Keyboard : LegendContextKind.Confirm
  return { kind, ...NO_FOCUS }
}

function contextOf(state: UiState): LegendContext | null {
  if (state.mode === UiMode.Radial) return { kind: LegendContextKind.Radial, ...NO_FOCUS }
  const frame = topFrameOf(state)
  return state.mode === UiMode.Panels && frame !== undefined ? panelsContext(frame) : null
}

function keyView(glyph: ValueOf<typeof KeyGlyph>, state: UiState, translate: Translate, muted: boolean): LegendGlyphView {
  const bound = state.binding.radial
  if (glyph === KeyGlyph.RadialKey && bound.length > 0) return { glyph: BINDING_GLYPH, label: bound, muted }
  return { glyph, label: translate(`ui.glyph.key.${glyph}`), muted }
}

function padView(glyph: ValueOf<typeof PadGlyph>, translate: Translate, muted: boolean): LegendGlyphView {
  return { glyph, label: translate(`ui.glyph.pad.${glyph}`), muted }
}

export function legendView(state: UiState, translate: Translate): LegendView | null {
  const context = contextOf(state)
  if (context === null) return null
  const gamepad = state.modality === Modality.Gamepad
  return {
    glyphSet: state.glyphSet,
    modality: state.modality,
    entries: legendEntries(context).map((entry) => ({
      action: entry.action,
      label: translate(`ui.legend.${entry.action}`),
      hold: entry.hold,
      keys: entry.keys.map((glyph) => keyView(glyph, state, translate, gamepad)),
      pad: entry.pad.map((glyph) => padView(glyph, translate, !gamepad)),
    })),
  }
}
