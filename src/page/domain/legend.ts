import { ItemKind } from '@openmemorykit/ui/contract'
import type { ValueOf } from '@openmemorykit/core/shared'

export const LegendAction = {
  Aim: 'aim',
  Navigate: 'navigate',
  Select: 'select',
  Change: 'change',
  Edit: 'edit',
  Back: 'back',
  CloseAll: 'closeAll',
  Close: 'close',
  Type: 'type',
  Erase: 'erase',
  Space: 'space',
  Layer: 'layer',
  Submit: 'submit',
  Choose: 'choose',
  Answer: 'answer',
} as const

export const LegendContextKind = { Radial: 'radial', List: 'list', Keyboard: 'keyboard', Confirm: 'confirm' } as const

export const PadGlyph = {
  LeftStick: 'leftStick',
  Dpad: 'dpad',
  DpadHorizontal: 'dpadHorizontal',
  DpadVertical: 'dpadVertical',
  A: 'a',
  B: 'b',
  X: 'x',
  Y: 'y',
  Lb: 'lb',
  Rb: 'rb',
  Menu: 'menu',
  View: 'view',
} as const

export const KeyGlyph = {
  Arrows: 'arrows',
  ArrowsHorizontal: 'arrowsHorizontal',
  ArrowsVertical: 'arrowsVertical',
  Enter: 'enter',
  Escape: 'escape',
  Backspace: 'backspace',
  Space: 'space',
  Tab: 'tab',
  RadialKey: 'radialKey',
  Mouse: 'mouse',
  Letters: 'letters',
} as const

export interface LegendContext {
  readonly kind: ValueOf<typeof LegendContextKind>
  readonly focusedKind: ItemKind | null
  readonly focusedDisabled: boolean
}

export interface LegendEntry {
  readonly action: ValueOf<typeof LegendAction>
  readonly keys: readonly ValueOf<typeof KeyGlyph>[]
  readonly pad: readonly ValueOf<typeof PadGlyph>[]
  readonly holdAction: ValueOf<typeof LegendAction> | null
}

const entry = (
  action: LegendEntry['action'],
  keys: LegendEntry['keys'],
  pad: LegendEntry['pad'],
  holdAction: LegendEntry['holdAction'] = null,
): LegendEntry => ({ action, keys, pad, holdAction })

const BACK = entry(LegendAction.Back, [KeyGlyph.Escape], [PadGlyph.B])
const BACK_OR_CLOSE_ALL = entry(LegendAction.Back, [KeyGlyph.Escape], [PadGlyph.B], LegendAction.CloseAll)
const NAVIGATE = entry(LegendAction.Navigate, [KeyGlyph.ArrowsVertical], [PadGlyph.DpadVertical])
const SELECT = entry(LegendAction.Select, [KeyGlyph.Enter], [PadGlyph.A])
const CHANGE = entry(LegendAction.Change, [KeyGlyph.ArrowsHorizontal], [PadGlyph.DpadHorizontal])
const EDIT = entry(LegendAction.Edit, [KeyGlyph.Enter], [PadGlyph.A])

const RADIAL: readonly LegendEntry[] = [
  entry(LegendAction.Aim, [KeyGlyph.Mouse], [PadGlyph.LeftStick]),
  SELECT,
  BACK,
  entry(LegendAction.Close, [KeyGlyph.RadialKey], [PadGlyph.View]),
]

const KEYBOARD: readonly LegendEntry[] = [
  entry(LegendAction.Type, [KeyGlyph.Letters], [PadGlyph.A]),
  entry(LegendAction.Erase, [KeyGlyph.Backspace], [PadGlyph.X]),
  entry(LegendAction.Space, [KeyGlyph.Space], [PadGlyph.Y]),
  entry(LegendAction.Layer, [KeyGlyph.Tab], [PadGlyph.Lb, PadGlyph.Rb]),
  entry(LegendAction.Submit, [KeyGlyph.Enter], [PadGlyph.Menu]),
  BACK,
]

const CONFIRM: readonly LegendEntry[] = [
  entry(LegendAction.Choose, [KeyGlyph.ArrowsVertical], [PadGlyph.DpadVertical]),
  entry(LegendAction.Answer, [KeyGlyph.Enter], [PadGlyph.A]),
  BACK,
]

function listEntries(context: LegendContext): readonly LegendEntry[] {
  switch (context.focusedKind) {
    case ItemKind.Action:
    case ItemKind.Link:
      return context.focusedDisabled ? [NAVIGATE, BACK_OR_CLOSE_ALL] : [NAVIGATE, SELECT, BACK_OR_CLOSE_ALL]
    case ItemKind.Cycle:
    case ItemKind.Toggle:
      return [NAVIGATE, CHANGE, BACK_OR_CLOSE_ALL]
    case ItemKind.Text:
      return [NAVIGATE, EDIT, BACK_OR_CLOSE_ALL]
    default:
      return [NAVIGATE, BACK_OR_CLOSE_ALL]
  }
}

export function legendEntries(context: LegendContext): readonly LegendEntry[] {
  switch (context.kind) {
    case LegendContextKind.Radial:
      return RADIAL
    case LegendContextKind.Keyboard:
      return KEYBOARD
    case LegendContextKind.Confirm:
      return CONFIRM
    case LegendContextKind.List:
      return listEntries(context)
  }
}
