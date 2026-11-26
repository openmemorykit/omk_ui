import { describe, expect, it } from 'vitest'
import { ItemKind } from '@openmemorykit/ui/contract'
import { KeyGlyph, legendEntries, LegendAction, LegendContextKind, PadGlyph } from '../../../src/page/domain/legend'
import type { LegendContext } from '../../../src/page/domain/legend'

const list = (focusedKind: LegendContext['focusedKind'], focusedDisabled = false): LegendContext => ({ kind: LegendContextKind.List, focusedKind, focusedDisabled })
const actionsOf = (context: LegendContext): readonly string[] => legendEntries(context).map((entry) => entry.action)
const NAVIGATE_BACK_CLOSE_ALL = [LegendAction.Navigate, LegendAction.Back, LegendAction.CloseAll]

describe('legendEntries', () => {
  it('describes the radial', () => {
    expect(legendEntries({ kind: LegendContextKind.Radial, focusedKind: null, focusedDisabled: false })).toEqual([
      { action: LegendAction.Aim, keys: [KeyGlyph.Mouse], pad: [PadGlyph.LeftStick], hold: false },
      { action: LegendAction.Select, keys: [KeyGlyph.Enter], pad: [PadGlyph.A], hold: false },
      { action: LegendAction.Back, keys: [KeyGlyph.Escape], pad: [PadGlyph.B], hold: false },
      { action: LegendAction.Close, keys: [KeyGlyph.RadialKey], pad: [PadGlyph.View], hold: false },
    ])
  })

  it.each([ItemKind.Action, ItemKind.Link])('describes a list focused on %s', (kind) => {
    expect(actionsOf(list(kind))).toEqual([LegendAction.Navigate, LegendAction.Select, LegendAction.Back, LegendAction.CloseAll])
  })

  it.each([ItemKind.Action, ItemKind.Link])('drops select for a disabled %s', (kind) => {
    expect(actionsOf(list(kind, true))).toEqual(NAVIGATE_BACK_CLOSE_ALL)
  })

  it.each([ItemKind.Cycle, ItemKind.Toggle])('offers change on %s', (kind) => {
    const entries = legendEntries(list(kind))
    expect(entries.map((entry) => entry.action)).toEqual([LegendAction.Navigate, LegendAction.Change, LegendAction.Back, LegendAction.CloseAll])
    expect(entries[1]).toEqual({ action: LegendAction.Change, keys: [KeyGlyph.ArrowsHorizontal], pad: [PadGlyph.DpadHorizontal], hold: false })
  })

  it('offers edit on a text item', () => {
    const entries = legendEntries(list(ItemKind.Text))
    expect(entries.map((entry) => entry.action)).toEqual([LegendAction.Navigate, LegendAction.Edit, LegendAction.Back, LegendAction.CloseAll])
    expect(entries[1]).toEqual({ action: LegendAction.Edit, keys: [KeyGlyph.Enter], pad: [PadGlyph.A], hold: false })
  })

  it.each([ItemKind.Info, ItemKind.Section, null])('offers only navigation on %s', (kind) => {
    expect(actionsOf(list(kind))).toEqual(NAVIGATE_BACK_CLOSE_ALL)
  })

  it('makes close all a hold on escape and B, and nothing else a hold', () => {
    const entries = legendEntries(list(ItemKind.Action))
    const closeAll = entries.find((entry) => entry.action === LegendAction.CloseAll)
    expect(closeAll).toEqual({ action: LegendAction.CloseAll, keys: [KeyGlyph.Escape], pad: [PadGlyph.B], hold: true })
    expect(entries.filter((entry) => entry.hold)).toHaveLength(1)
  })

  it('describes the keyboard', () => {
    expect(legendEntries({ kind: LegendContextKind.Keyboard, focusedKind: null, focusedDisabled: false })).toEqual([
      { action: LegendAction.Type, keys: [KeyGlyph.Letters], pad: [PadGlyph.A], hold: false },
      { action: LegendAction.Erase, keys: [KeyGlyph.Backspace], pad: [PadGlyph.X], hold: false },
      { action: LegendAction.Space, keys: [KeyGlyph.Space], pad: [PadGlyph.Y], hold: false },
      { action: LegendAction.Layer, keys: [KeyGlyph.Tab], pad: [PadGlyph.Lb, PadGlyph.Rb], hold: false },
      { action: LegendAction.Submit, keys: [KeyGlyph.Enter], pad: [PadGlyph.Menu], hold: false },
      { action: LegendAction.Back, keys: [KeyGlyph.Escape], pad: [PadGlyph.B], hold: false },
    ])
  })

  it('describes the confirmation', () => {
    expect(legendEntries({ kind: LegendContextKind.Confirm, focusedKind: null, focusedDisabled: false })).toEqual([
      { action: LegendAction.Choose, keys: [KeyGlyph.ArrowsVertical], pad: [PadGlyph.DpadVertical], hold: false },
      { action: LegendAction.Answer, keys: [KeyGlyph.Enter], pad: [PadGlyph.A], hold: false },
      { action: LegendAction.Back, keys: [KeyGlyph.Escape], pad: [PadGlyph.B], hold: false },
    ])
  })
})
