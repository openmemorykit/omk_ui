import { Intent } from '../../protocol/intents'
import {
  FALLBACK_KEY,
  KeyAction,
  KeyboardLayer,
  keyboardLayout,
  type KeyboardLanguage,
  type KeyboardRows,
  type VirtualKey,
} from './keyboard-layouts'

export interface KeyboardState {
  readonly language: KeyboardLanguage
  readonly layer: KeyboardLayer
  readonly row: number
  readonly unit: number
  readonly shift: boolean
  readonly value: string
  readonly maxLength: number
}

export interface KeyboardResult {
  readonly state: KeyboardState
  readonly submitted: boolean
  readonly limitReached: boolean
}

const LAYER_ORDER: readonly KeyboardLayer[] = Object.values(KeyboardLayer)
const LONE_SURROGATE = /^[\ud800-\udfff]$/
const CONTROL_CHARACTER = /^\p{Cc}$/u
const NO_MOVE = 0
const NOT_FOUND = -1
const FIRST_INDEX = 0
const LAST_OFFSET = 1

function isStorable(codePoint: string): boolean {
  return !LONE_SURROGATE.test(codePoint) && !CONTROL_CHARACTER.test(codePoint)
}

interface Taken { readonly text: string; readonly cut: boolean }

function takeWithin(text: string, budget: number): Taken {
  let taken = ''
  for (const codePoint of text) {
    if (!isStorable(codePoint)) continue
    if (taken.length + codePoint.length > budget) return { text: taken, cut: true }
    taken += codePoint
  }
  return { text: taken, cut: false }
}

function sanitizedLength(maxLength: number): number {
  return Number.isFinite(maxLength) ? Math.max(NO_MOVE, Math.trunc(maxLength)) : NO_MOVE
}

export function openKeyboard(language: KeyboardLanguage, value: string, maxLength: number): KeyboardState {
  const limit = sanitizedLength(maxLength)
  return {
    language,
    layer: KeyboardLayer.Letters,
    row: FIRST_INDEX,
    unit: FIRST_INDEX,
    shift: false,
    value: takeWithin(value, limit).text,
    maxLength: limit,
  }
}

function rowsOf(state: KeyboardState): KeyboardRows {
  return keyboardLayout(state.language, state.layer)
}

function rowOf(state: KeyboardState): readonly VirtualKey[] {
  const rows = rowsOf(state)
  return rows[state.row] ?? rows[FIRST_INDEX] ?? []
}

function keyStarts(row: readonly VirtualKey[]): readonly number[] {
  let start = NO_MOVE
  return row.map((key) => {
    const current = start
    start += key.units
    return current
  })
}

function keyIndexAt(row: readonly VirtualKey[], unit: number): number {
  const starts = keyStarts(row)
  const index = starts.findIndex((start, position) => unit >= start && unit < start + (row[position]?.units ?? NO_MOVE))
  return index === NOT_FOUND ? row.length - LAST_OFFSET : index
}

function stepHorizontal(state: KeyboardState, step: 1 | -1): KeyboardState {
  const row = rowOf(state)
  const starts = keyStarts(row)
  const next = (keyIndexAt(row, state.unit) + step + row.length) % row.length
  return { ...state, unit: starts[next] ?? NO_MOVE }
}

function stepVertical(state: KeyboardState, step: 1 | -1): KeyboardState {
  const row = Math.min(Math.max(state.row + step, FIRST_INDEX), rowsOf(state).length - LAST_OFFSET)
  return { ...state, row }
}

export function moveKeyboardFocus(state: KeyboardState, direction: Intent): KeyboardState {
  switch (direction) {
    case Intent.Up:
      return stepVertical(state, -1)
    case Intent.Down:
      return stepVertical(state, 1)
    case Intent.Left:
      return stepHorizontal(state, -1)
    case Intent.Right:
      return stepHorizontal(state, 1)
    default:
      return state
  }
}

export function focusKeyAt(state: KeyboardState, row: number, unit: number): KeyboardState | null {
  const keys = Number.isInteger(row) && row >= FIRST_INDEX ? rowsOf(state)[row] : undefined
  if (keys === undefined || !Number.isInteger(unit) || unit < FIRST_INDEX) return null
  const starts = keyStarts(keys)
  const index = starts.findIndex((start, position) => unit >= start && unit < start + (keys[position]?.units ?? NO_MOVE))
  const start = starts[index]
  return index === NOT_FOUND || start === undefined ? null : { ...state, row, unit: start }
}

export function focusedKey(state: KeyboardState): VirtualKey {
  const row = rowOf(state)
  return row[keyIndexAt(row, state.unit)] ?? FALLBACK_KEY
}

function result(state: KeyboardState, submitted: boolean, limitReached: boolean): KeyboardResult {
  return { state, submitted, limitReached }
}

function append(state: KeyboardState, text: string): KeyboardResult {
  const { text: added, cut } = takeWithin(text, state.maxLength - state.value.length)
  if (added.length === NO_MOVE) return result(state, false, cut)
  return result({ ...state, value: state.value + added, shift: false }, false, cut)
}

function displayed(state: KeyboardState, key: VirtualKey): string {
  const character = key.character ?? ''
  return state.shift ? character.toUpperCase() : character
}

export function pressFocusedKey(state: KeyboardState): KeyboardResult {
  const key = focusedKey(state)
  switch (key.action) {
    case KeyAction.Character:
      return append(state, displayed(state, key))
    case KeyAction.Shift:
      return result({ ...state, shift: !state.shift }, false, false)
    case KeyAction.Erase:
      return result(eraseCharacter(state), false, false)
    case KeyAction.Layer:
      return result(switchLayer(state, 1), false, false)
    case KeyAction.Space:
      return insertSpace(state)
    case KeyAction.Submit:
      return result(state, true, false)
  }
}

export function eraseCharacter(state: KeyboardState): KeyboardState {
  const remaining = Array.from(state.value).slice(FIRST_INDEX, -1).join('')
  return { ...state, value: remaining }
}

export function insertSpace(state: KeyboardState): KeyboardResult {
  return append(state, ' ')
}

export function switchLayer(state: KeyboardState, step: 1 | -1): KeyboardState {
  const index = LAYER_ORDER.indexOf(state.layer)
  const layer = LAYER_ORDER[(index + step + LAYER_ORDER.length) % LAYER_ORDER.length] ?? state.layer
  return { ...state, layer }
}

export function insertText(state: KeyboardState, text: string): KeyboardResult {
  return append(state, text)
}
