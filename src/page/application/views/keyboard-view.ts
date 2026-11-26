import { KeyAction, KeyboardLayer, keyboardLayout, type KeyboardLanguage, type VirtualKey } from '../../domain/keyboard-layouts'
import type { VirtualKeyboardLayer } from '../../domain/ui-state'
import type { MessageKey, Translate } from '../../i18n/messages'

export interface KeyView {
  readonly row: number
  readonly unit: number
  readonly units: number
  readonly action: KeyAction
  readonly text: string
  readonly label: string
  readonly focused: boolean
  readonly active: boolean
}

export interface KeyboardView {
  readonly itemId: string
  readonly layerName: string
  readonly rows: readonly (readonly KeyView[])[]
  readonly shift: boolean
  readonly value: string
  readonly cursor: number
  readonly length: number
  readonly maxLength: number
  readonly counterText: string
  readonly atLimit: boolean
}

const LAYER_KEYS: Readonly<Record<KeyboardLayer, MessageKey>> = Object.freeze({
  [KeyboardLayer.Letters]: 'ui.keyboard.layer.letters',
  [KeyboardLayer.AccentsDigits]: 'ui.keyboard.layer.accentsDigits',
  [KeyboardLayer.Symbols]: 'ui.keyboard.layer.symbols',
})

const ACTION_KEYS: Readonly<Record<Exclude<KeyAction, typeof KeyAction.Character | typeof KeyAction.Layer | typeof KeyAction.Shift>, MessageKey>> =
  Object.freeze({
    [KeyAction.Erase]: 'ui.legend.erase',
    [KeyAction.Space]: 'ui.legend.space',
    [KeyAction.Submit]: 'ui.legend.submit',
  })

const LAYER_ORDER: readonly KeyboardLayer[] = Object.values(KeyboardLayer)
const FIRST = 0
const NEXT = 1
const NO_TEXT = ''
const SHIFT_LABEL = '⇧'

function nextLayer(layer: KeyboardLayer): KeyboardLayer {
  return LAYER_ORDER[(LAYER_ORDER.indexOf(layer) + NEXT) % LAYER_ORDER.length] ?? layer
}

function characterOf(key: VirtualKey, shift: boolean): string {
  const character = key.character ?? NO_TEXT
  return shift ? character.toUpperCase() : character
}

function labelOf(key: VirtualKey, layer: VirtualKeyboardLayer, text: string, translate: Translate): string {
  switch (key.action) {
    case KeyAction.Character:
      return text
    case KeyAction.Shift:
      return SHIFT_LABEL
    case KeyAction.Layer:
      return translate(LAYER_KEYS[nextLayer(layer.keyboard.layer)])
    default:
      return translate(ACTION_KEYS[key.action])
  }
}

function keyViews(row: readonly VirtualKey[], rowIndex: number, layer: VirtualKeyboardLayer, translate: Translate): readonly KeyView[] {
  const { keyboard } = layer
  let start = FIRST
  const views = row.map((key) => {
    const unit = start
    start += key.units
    const text = key.action === KeyAction.Character ? characterOf(key, keyboard.shift) : NO_TEXT
    return Object.freeze({
      row: rowIndex,
      unit,
      units: key.units,
      action: key.action,
      text,
      label: labelOf(key, layer, text, translate),
      focused: rowIndex === keyboard.row && keyboard.unit >= unit && keyboard.unit < unit + key.units,
      active: key.action === KeyAction.Shift && keyboard.shift,
    })
  })
  return Object.freeze(views)
}

export function keyboardView(layer: VirtualKeyboardLayer, language: KeyboardLanguage, translate: Translate): KeyboardView {
  const { keyboard } = layer
  const rows = keyboardLayout(language, keyboard.layer).map((row, index) => keyViews(row, index, layer, translate))
  const length = keyboard.value.length
  return Object.freeze({
    itemId: layer.itemId,
    layerName: translate(LAYER_KEYS[keyboard.layer]),
    rows: Object.freeze(rows),
    shift: keyboard.shift,
    value: keyboard.value,
    cursor: length,
    length,
    maxLength: keyboard.maxLength,
    counterText: `${String(length)} / ${String(keyboard.maxLength)}`,
    atLimit: length >= keyboard.maxLength,
  })
}
