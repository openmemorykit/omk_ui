import { describe, expect, it } from 'vitest'
import { ItemKind } from '@openmemorykit/ui/contract'
import { legendView } from '../../../../src/page/application/views/legend-view'
import { BINDING_GLYPH } from '../../../../src/page/theme/glyph-view'
import { KeyGlyph, LegendAction, PadGlyph } from '../../../../src/page/domain/legend'
import { createInitialState } from '../../../../src/page/domain/ui-state'
import { FORM_SUBMIT_ROW_ID } from '../../../../src/page/domain/panel-rows'
import { Modality } from '../../../../src/protocol/intents'
import { GlyphSet, UiMode } from '../../../../src/protocol/page-vocabulary'
import { CONFIRM_LAYER, itemOf, KEYBOARD_LAYER, panelsState, radialEntry, radialState, translate, withModality } from './helpers'

const actionsOf = (state: Parameters<typeof legendView>[0]): readonly string[] | undefined => legendView(state, translate)?.entries.map((entry) => entry.action)
const FOCUSED = 'focused'

function listState(kind: Parameters<typeof itemOf>[0], disabled = false): ReturnType<typeof panelsState> {
  const item = { ...itemOf(kind, disabled), id: FOCUSED }
  return panelsState([item], FOCUSED)
}

describe('legendView contexts', () => {
  it.each([UiMode.Idle, UiMode.Waiting])('has no legend in %s mode', (mode) => {
    expect(legendView({ ...createInitialState(), mode }, translate)).toBeNull()
  })

  it('has no legend in panels mode without a frame', () => {
    expect(legendView({ ...createInitialState(), mode: UiMode.Panels }, translate)).toBeNull()
  })

  it('describes the radial', () => {
    expect(actionsOf(radialState([radialEntry('a')]))).toEqual([LegendAction.Aim, LegendAction.Select, LegendAction.Back, LegendAction.Close])
  })

  it('describes a list focused on an action', () => {
    expect(actionsOf(listState(ItemKind.Action))).toEqual([LegendAction.Navigate, LegendAction.Select, LegendAction.Back])
  })

  it('drops select on a disabled action', () => {
    expect(actionsOf(listState(ItemKind.Action, true))).toEqual([LegendAction.Navigate, LegendAction.Back])
  })

  it.each([ItemKind.Cycle, ItemKind.Toggle])('offers change on %s', (kind) => {
    expect(actionsOf(listState(kind))).toContain(LegendAction.Change)
  })

  it('offers edit on a text item', () => {
    expect(actionsOf(listState(ItemKind.Text))).toContain(LegendAction.Edit)
  })

  it('has only navigation and back with no focused item', () => {
    expect(actionsOf(panelsState([itemOf(ItemKind.Action)], null))).toEqual([LegendAction.Navigate, LegendAction.Back])
  })

  it('has the same legend when the focus names an unknown row', () => {
    expect(actionsOf(panelsState([itemOf(ItemKind.Action)], 'ghost'))).toEqual([LegendAction.Navigate, LegendAction.Back])
  })

  it('has only navigation and back for a frame without panel', () => {
    const base = panelsState([], null)
    const [frame] = base.stack
    const bare = { ...base, stack: [{ ...frame, panel: null }] } as unknown as typeof base
    expect(actionsOf(bare)).toEqual([LegendAction.Navigate, LegendAction.Back])
  })

  it('treats the form submit row as an enabled action', () => {
    const base = panelsState([], FORM_SUBMIT_ROW_ID)
    const [frame] = base.stack
    const form = { ...frame, panel: { owner: 'res', panel: { ...frame?.panel?.panel, kind: 'form', submitLabel: 'Go', items: [] } } }
    expect(actionsOf({ ...base, stack: [form] } as typeof base)).toContain(LegendAction.Select)
  })

  it('describes the keyboard layer', () => {
    expect(actionsOf(panelsState([itemOf(ItemKind.Text)], null, [KEYBOARD_LAYER]))).toEqual([
      LegendAction.Type,
      LegendAction.Erase,
      LegendAction.Space,
      LegendAction.Layer,
      LegendAction.Submit,
      LegendAction.Back,
    ])
  })

  it('describes the confirm layer, the top layer winning', () => {
    expect(actionsOf(panelsState([itemOf(ItemKind.Text)], null, [KEYBOARD_LAYER, CONFIRM_LAYER]))).toEqual([LegendAction.Choose, LegendAction.Answer, LegendAction.Back])
  })
})

describe('legendView entries', () => {
  const radial = radialState([radialEntry('a')])

  it('carries the translated action label and the label of the action held', () => {
    const entries = legendView(listState(ItemKind.Action), translate)?.entries ?? []
    expect(entries.map((entry) => entry.label)).toEqual(['t:ui.legend.navigate', 't:ui.legend.select', 't:ui.legend.back'])
    expect(entries.map((entry) => entry.holdLabel)).toEqual([null, null, 't:ui.legend.closeAll'])
  })

  it('carries the translated hold word, so that the component translates nothing', () => {
    expect(legendView(listState(ItemKind.Action), translate)?.holdWord).toBe('t:ui.prompt.hold')
  })

  it('translates the accessible label of keyboard and pad glyphs', () => {
    const [aim] = legendView(radial, translate)?.entries ?? []
    expect(aim?.keys).toEqual([{ glyph: KeyGlyph.Mouse, label: 't:ui.glyph.key.mouse', muted: false }])
    expect(aim?.pad).toEqual([{ glyph: PadGlyph.LeftStick, label: 't:ui.glyph.pad.leftStick', muted: true }])
  })

  it('keeps two pad glyphs for the layer switch', () => {
    const view = legendView(panelsState([itemOf(ItemKind.Text)], null, [KEYBOARD_LAYER]), translate)
    const layer = view?.entries.find((entry) => entry.action === LegendAction.Layer)
    expect(layer?.pad.map((glyph) => glyph.glyph)).toEqual([PadGlyph.Lb, PadGlyph.Rb])
  })

  it('shows the bound radial key as a binding glyph', () => {
    const state = { ...radial, binding: { radial: 'F1', interact: 'E', pushToTalk: 'N' } }
    const close = legendView(state, translate)?.entries.find((entry) => entry.action === LegendAction.Close)
    expect(close?.keys).toEqual([{ glyph: BINDING_GLYPH, label: 'F1', muted: false }])
  })

  it('falls back on the translated radial key name when nothing is bound', () => {
    const close = legendView(radial, translate)?.entries.find((entry) => entry.action === LegendAction.Close)
    expect(close?.keys).toEqual([{ glyph: KeyGlyph.RadialKey, label: 't:ui.glyph.key.radialKey', muted: false }])
  })

  it('highlights the keyboard when the modality is keyboard and mouse', () => {
    const view = legendView(radial, translate)
    expect(view?.modality).toBe(Modality.KeyboardMouse)
    expect(view?.entries.flatMap((entry) => entry.keys).every((glyph) => !glyph.muted)).toBe(true)
    expect(view?.entries.flatMap((entry) => entry.pad).every((glyph) => glyph.muted)).toBe(true)
  })

  it('highlights the pad when the modality is gamepad', () => {
    const view = legendView(withModality(radial, Modality.Gamepad), translate)
    expect(view?.modality).toBe(Modality.Gamepad)
    expect(view?.entries.flatMap((entry) => entry.keys).every((glyph) => glyph.muted)).toBe(true)
    expect(view?.entries.flatMap((entry) => entry.pad).every((glyph) => !glyph.muted)).toBe(true)
  })

  it.each([GlyphSet.Xbox, GlyphSet.PlayStation])('passes the %s glyph set', (glyphSet) => {
    expect(legendView({ ...radial, glyphSet }, translate)?.glyphSet).toBe(glyphSet)
  })
})
