import type { ValueOf } from '@openmemorykit/core/shared'

export const KeyboardLanguage = { French: 'fr', English: 'en' } as const
export type KeyboardLanguage = ValueOf<typeof KeyboardLanguage>

export const KeyboardLayer = { Letters: 'letters', AccentsDigits: 'accentsDigits', Symbols: 'symbols' } as const
export type KeyboardLayer = ValueOf<typeof KeyboardLayer>

export const KeyAction = {
  Character: 'character',
  Shift: 'shift',
  Erase: 'erase',
  Layer: 'layer',
  Space: 'space',
  Submit: 'submit',
} as const
export type KeyAction = ValueOf<typeof KeyAction>

export interface VirtualKey {
  readonly action: KeyAction
  readonly character: string | null
  readonly units: number
}

export type KeyboardRows = readonly (readonly VirtualKey[])[]

export const KEYBOARD_ROW_UNITS = 10

const WIDE_KEY_UNITS = 2
const SPACE_UNITS = 4
const SINGLE_UNIT = 1

function characterKeys(characters: string): readonly VirtualKey[] {
  return Array.from(characters).map((character) => Object.freeze({
    action: KeyAction.Character,
    character,
    units: SINGLE_UNIT,
  }))
}

function actionKey(action: KeyAction, units: number): VirtualKey {
  return Object.freeze({ action, character: null, units })
}

const SHIFT_KEY = actionKey(KeyAction.Shift, SINGLE_UNIT)
const ERASE_KEY = actionKey(KeyAction.Erase, SINGLE_UNIT)

export const FALLBACK_KEY: VirtualKey = actionKey(KeyAction.Space, SPACE_UNITS)

const BOTTOM_ROW: readonly VirtualKey[] = Object.freeze([
  actionKey(KeyAction.Layer, WIDE_KEY_UNITS),
  ...characterKeys(','),
  FALLBACK_KEY,
  ...characterKeys('.'),
  actionKey(KeyAction.Submit, WIDE_KEY_UNITS),
])

function buildLayout(first: string, second: string, third: string): KeyboardRows {
  const rows = [
    characterKeys(first),
    characterKeys(second),
    [SHIFT_KEY, ...characterKeys(third), ERASE_KEY],
    BOTTOM_ROW,
  ]
  return Object.freeze(rows.map((row) => Object.freeze(row)))
}

const SHARED_LAYERS = {
  [KeyboardLayer.AccentsDigits]: buildLayout('1234567890', 'éèêëàâçùûü', 'îïôœæ«»"'),
  [KeyboardLayer.Symbols]: buildLayout('@#&/*+=%€$', '()[]_;:?!~', '<>{}|\\^°'),
} as const

const LAYOUTS: Readonly<Record<KeyboardLanguage, Readonly<Record<KeyboardLayer, KeyboardRows>>>> = Object.freeze({
  [KeyboardLanguage.French]: Object.freeze({
    [KeyboardLayer.Letters]: buildLayout('azertyuiop', 'qsdfghjklm', "wxcvbn'-"),
    ...SHARED_LAYERS,
  }),
  [KeyboardLanguage.English]: Object.freeze({
    [KeyboardLayer.Letters]: buildLayout('qwertyuiop', "asdfghjkl'", 'zxcvbnm-'),
    ...SHARED_LAYERS,
  }),
})

export function keyboardLayout(language: KeyboardLanguage, layer: KeyboardLayer): KeyboardRows {
  return LAYOUTS[language][layer]
}
