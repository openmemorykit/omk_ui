import { Intent } from '../../protocol/intents'
import type { BindingLabels } from '../../protocol/to-page'

export const KeyCode = {
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  KeyW: 'KeyW',
  KeyA: 'KeyA',
  KeyS: 'KeyS',
  KeyD: 'KeyD',
  KeyQ: 'KeyQ',
  KeyE: 'KeyE',
  Enter: 'Enter',
  Space: 'Space',
  Escape: 'Escape',
  Tab: 'Tab',
  Backspace: 'Backspace',
  F1: 'F1',
} as const

export interface KeyPress {
  readonly code: string
  readonly key: string
  readonly shift: boolean
  readonly inTextField: boolean
}

export const KeyOutcomeKind = { Intent: 'intent', PushToTalk: 'pushToTalk', None: 'none' } as const
export type KeyOutcome =
  | { readonly kind: typeof KeyOutcomeKind.Intent; readonly intent: Intent }
  | { readonly kind: typeof KeyOutcomeKind.PushToTalk }
  | { readonly kind: typeof KeyOutcomeKind.None }

export const BindingKind = { Text: 'text', Known: 'known', Unknown: 'unknown' } as const
export type DecodedBinding =
  | { readonly kind: typeof BindingKind.Text; readonly text: string }
  | { readonly kind: typeof BindingKind.Known; readonly code: string }
  | { readonly kind: typeof BindingKind.Unknown; readonly raw: string }

export const BOUND_KEY_CODES: Readonly<Record<number, string>> = Object.freeze({ 170: 'F1', 194: 'ArrowUp', 102: 'MouseMiddle' })

const TEXT_BINDING_PREFIX = 't_'
const CODE_BINDING_PREFIX = 'b_'
const DIGITS_ONLY = /^\d{1,9}$/

const ALWAYS_INTENTS: ReadonlyMap<string, Intent> = new Map([
  [KeyCode.ArrowUp, Intent.Up],
  [KeyCode.ArrowDown, Intent.Down],
  [KeyCode.ArrowLeft, Intent.Left],
  [KeyCode.ArrowRight, Intent.Right],
  [KeyCode.Enter, Intent.Confirm],
  [KeyCode.Escape, Intent.Back],
])

const OUTSIDE_TEXT_INTENTS: ReadonlyMap<string, Intent> = new Map([
  [KeyCode.KeyW, Intent.Up],
  [KeyCode.KeyS, Intent.Down],
  [KeyCode.KeyA, Intent.Left],
  [KeyCode.KeyD, Intent.Right],
  [KeyCode.KeyQ, Intent.TabPrev],
  [KeyCode.KeyE, Intent.TabNext],
  [KeyCode.Space, Intent.Confirm],
])

export function decodeBinding(raw: string): DecodedBinding {
  if (raw.startsWith(TEXT_BINDING_PREFIX) && raw.length > TEXT_BINDING_PREFIX.length) {
    return { kind: BindingKind.Text, text: raw.slice(TEXT_BINDING_PREFIX.length) }
  }
  const digits = raw.startsWith(CODE_BINDING_PREFIX) ? raw.slice(CODE_BINDING_PREFIX.length) : ''
  if (DIGITS_ONLY.test(digits) && Object.prototype.hasOwnProperty.call(BOUND_KEY_CODES, digits)) {
    return { kind: BindingKind.Known, code: BOUND_KEY_CODES[Number(digits)] as string }
  }
  return { kind: BindingKind.Unknown, raw }
}

function matchesBinding(press: KeyPress, raw: string): boolean {
  const binding = decodeBinding(raw)
  if (binding.kind === BindingKind.Known) return press.code === binding.code
  if (binding.kind === BindingKind.Text) return !press.inTextField && press.key.toUpperCase() === binding.text.toUpperCase()
  return false
}

const NONE: KeyOutcome = { kind: KeyOutcomeKind.None }
const intentOutcome = (intent: Intent): KeyOutcome => ({ kind: KeyOutcomeKind.Intent, intent })

export function mapKey(press: KeyPress, bindings: BindingLabels): KeyOutcome {
  if (matchesBinding(press, bindings.pushToTalk)) return { kind: KeyOutcomeKind.PushToTalk }
  if (matchesBinding(press, bindings.radial)) return intentOutcome(Intent.Radial)
  const always = ALWAYS_INTENTS.get(press.code)
  if (always !== undefined) return intentOutcome(always)
  if (press.code === KeyCode.Tab) return intentOutcome(press.shift ? Intent.TabPrev : Intent.TabNext)
  if (press.inTextField) return NONE
  const outside = OUTSIDE_TEXT_INTENTS.get(press.code)
  return outside === undefined ? NONE : intentOutcome(outside)
}
