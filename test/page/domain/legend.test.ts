import { describe, expect, it } from 'vitest'
import { ItemKind } from '@openmemorykit/ui/contract'
import { KeyGlyph, legendEntries, LegendAction, LegendContextKind, PadGlyph } from '../../../src/page/domain/legend'
import type { LegendContext } from '../../../src/page/domain/legend'

const list = (focusedKind: LegendContext['focusedKind'], focusedDisabled = false): LegendContext => ({ kind: LegendContextKind.List, focusedKind, focusedDisabled })
const actionsOf = (context: LegendContext): readonly string[] => legendEntries(context).map((entry) => entry.action)
const NAVIGATE_BACK = [LegendAction.Navigate, LegendAction.Back]

describe('legendEntries', () => {
  it('describes the radial', () => {
    expect(legendEntries({ kind: LegendContextKind.Radial, focusedKind: null, focusedDisabled: false })).toEqual([
      { action: LegendAction.Aim, keys: [KeyGlyph.Mouse], pad: [PadGlyph.LeftStick], holdAction: null },
      { action: LegendAction.Select, keys: [KeyGlyph.Enter], pad: [PadGlyph.A], holdAction: null },
      { action: LegendAction.Back, keys: [KeyGlyph.Escape], pad: [PadGlyph.B], holdAction: null },
      { action: LegendAction.Close, keys: [KeyGlyph.RadialKey], pad: [PadGlyph.View], holdAction: null },
    ])
  })

  it.each([ItemKind.Action, ItemKind.Link])('describes a list focused on %s', (kind) => {
    expect(actionsOf(list(kind))).toEqual([LegendAction.Navigate, LegendAction.Select, LegendAction.Back])
  })

  it.each([ItemKind.Action, ItemKind.Link])('drops select for a disabled %s', (kind) => {
    expect(actionsOf(list(kind, true))).toEqual(NAVIGATE_BACK)
  })

  it.each([ItemKind.Cycle, ItemKind.Toggle])('offers change on %s', (kind) => {
    const entries = legendEntries(list(kind))
    expect(entries.map((entry) => entry.action)).toEqual([LegendAction.Navigate, LegendAction.Change, LegendAction.Back])
    expect(entries[1]).toEqual({ action: LegendAction.Change, keys: [KeyGlyph.ArrowsHorizontal], pad: [PadGlyph.DpadHorizontal], holdAction: null })
  })

  it('offers edit on a text item', () => {
    const entries = legendEntries(list(ItemKind.Text))
    expect(entries.map((entry) => entry.action)).toEqual([LegendAction.Navigate, LegendAction.Edit, LegendAction.Back])
    expect(entries[1]).toEqual({ action: LegendAction.Edit, keys: [KeyGlyph.Enter], pad: [PadGlyph.A], holdAction: null })
  })

  it.each([ItemKind.Info, ItemKind.Section, null])('offers only navigation on %s', (kind) => {
    expect(actionsOf(list(kind))).toEqual(NAVIGATE_BACK)
  })

  it('shows escape and B once, as back with close all on a hold, and no other hold', () => {
    const entries = legendEntries(list(ItemKind.Action))
    const escapes = entries.filter((entry) => entry.keys.includes(KeyGlyph.Escape))
    expect(escapes).toEqual([{ action: LegendAction.Back, keys: [KeyGlyph.Escape], pad: [PadGlyph.B], holdAction: LegendAction.CloseAll }])
    expect(entries.filter((entry) => entry.holdAction !== null)).toHaveLength(1)
    expect(entries.some((entry) => entry.action === LegendAction.CloseAll)).toBe(false)
  })

  it('describes the keyboard', () => {
    expect(legendEntries({ kind: LegendContextKind.Keyboard, focusedKind: null, focusedDisabled: false })).toEqual([
      { action: LegendAction.Type, keys: [KeyGlyph.Letters], pad: [PadGlyph.A], holdAction: null },
      { action: LegendAction.Erase, keys: [KeyGlyph.Backspace], pad: [PadGlyph.X], holdAction: null },
      { action: LegendAction.Space, keys: [KeyGlyph.Space], pad: [PadGlyph.Y], holdAction: null },
      { action: LegendAction.Layer, keys: [KeyGlyph.Tab], pad: [PadGlyph.Lb, PadGlyph.Rb], holdAction: null },
      { action: LegendAction.Submit, keys: [KeyGlyph.Enter], pad: [PadGlyph.Menu], holdAction: null },
      { action: LegendAction.Back, keys: [KeyGlyph.Escape], pad: [PadGlyph.B], holdAction: null },
    ])
  })

  it('describes the confirmation', () => {
    expect(legendEntries({ kind: LegendContextKind.Confirm, focusedKind: null, focusedDisabled: false })).toEqual([
      { action: LegendAction.Choose, keys: [KeyGlyph.ArrowsVertical], pad: [PadGlyph.DpadVertical], holdAction: null },
      { action: LegendAction.Answer, keys: [KeyGlyph.Enter], pad: [PadGlyph.A], holdAction: null },
      { action: LegendAction.Back, keys: [KeyGlyph.Escape], pad: [PadGlyph.B], holdAction: null },
    ])
  })
})
