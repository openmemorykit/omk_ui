import { FIELD_MAX_LENGTH_MAX, ItemKind, type ConfirmContent, type Item } from '@openmemorykit/ui/contract'
import { FromPage } from '../../protocol/from-page'
import { Intent, IntentPhase } from '../../protocol/intents'
import { changeField, currentFieldValue } from './field-values'
import { checkField } from './form'
import { replyEvent, topFrameOf, topLayerOf, withLayer, withTopFrame } from './frame-updates'
import { KeyboardLanguage } from './keyboard-layouts'
import { PageCommandType, type LocalIntentCommand, type UiCommand, type UiCommandOf } from './page-commands'
import { sendToHost, unchanged, UiEffectType, withEffects, type CommandHandler, type Transition } from './ui-effects'
import { ConfirmChoice, ConfirmOrigin, LayerKind, type Frame, type UiState, type VirtualKeyboardLayer } from './ui-state'
import { eraseCharacter, focusKeyAt, insertSpace, insertText, moveKeyboardFocus, openKeyboard, pressFocusedKey, switchLayer, type KeyboardState } from './virtual-keyboard'

type TextItem = Extract<Item, { readonly kind: typeof ItemKind.Text }>

interface KeyboardContext { readonly frame: Frame; readonly layer: VirtualKeyboardLayer }

export const TYPED_TEXT_SCAN_UNITS = 2000

export const ABANDON_TEXT_CONTENT: ConfirmContent = Object.freeze({
  title: 'abandonText.title',
  text: 'abandonText.text',
  confirmLabel: 'abandonText.confirm',
  cancelLabel: 'abandonText.cancel',
  danger: true,
})

const PREVIOUS_LAYER = -1
const NEXT_LAYER = 1
const NOT_FOUND = -1
const EMPTY_TEXT = ''
const KEYBOARD_LANGUAGES: ReadonlyMap<string, KeyboardLanguage> = new Map(Object.values(KeyboardLanguage).map((language) => [language, language] as const))
const DIRECTIONS: ReadonlySet<Intent> = new Set<Intent>([Intent.Up, Intent.Down, Intent.Left, Intent.Right])

const isKeyboard = (layer: Frame['layers'][number]): layer is VirtualKeyboardLayer => layer.kind === LayerKind.Keyboard

function textItemOf(frame: Frame, itemId: string): TextItem | undefined {
  const item = frame.panel?.panel.items.find((candidate) => candidate.id === itemId)
  return item?.kind === ItemKind.Text ? item : undefined
}

export function openKeyboardLayer(state: UiState, frame: Frame, item: TextItem): Transition {
  const current = currentFieldValue(frame, item)
  const language = KEYBOARD_LANGUAGES.get(state.language) ?? KeyboardLanguage.English
  const keyboard = openKeyboard(language, typeof current === 'string' ? current : EMPTY_TEXT, Math.min(item.maxLength, FIELD_MAX_LENGTH_MAX))
  const opened = withLayer(frame, { kind: LayerKind.Keyboard, itemId: item.id, initialValue: keyboard.value, keyboard })
  if (opened === frame) return unchanged(state)
  return withEffects(withTopFrame(state, opened), [{ type: UiEffectType.FocusTextInput, itemId: item.id }, sendToHost({ type: FromPage.TextEntry, active: true })])
}

export function closeKeyboardLayer(state: UiState, keptValue: string | null): Transition {
  const frame = topFrameOf(state)
  const index = frame === undefined ? NOT_FOUND : frame.layers.findIndex(isKeyboard)
  const layer = frame?.layers[index]
  if (frame === undefined || layer === undefined || !isKeyboard(layer)) return unchanged(state)
  const closed: Frame = { ...frame, layers: frame.layers.slice(0, index) }
  const item = textItemOf(frame, layer.itemId)
  if (item === undefined) return unchanged(withTopFrame(state, closed))
  const change = keptValue === null ? { frame: closed, replies: [] } : changeField(closed, item, keptValue)
  const checked = change.frame.form === null ? change.frame : { ...change.frame, form: checkField(change.frame.form, item) }
  return withEffects(withTopFrame(state, checked), change.replies.length === 0 ? [] : [replyEvent(change.replies)])
}

function withKeyboard(state: UiState, context: KeyboardContext, keyboard: KeyboardState): Transition {
  if (keyboard === context.layer.keyboard) return unchanged(state)
  const layers = context.frame.layers.map((layer) => (layer === context.layer ? { ...context.layer, keyboard } : layer))
  return unchanged(withTopFrame(state, { ...context.frame, layers }))
}

function askAbandon(state: UiState, context: KeyboardContext): Transition {
  const { frame, layer } = context
  if (layer.keyboard.value === layer.initialValue) return closeKeyboardLayer(state, null)
  const abandon = { kind: LayerKind.Confirm, origin: ConfirmOrigin.AbandonText, content: ABANDON_TEXT_CONTENT, confirmId: null, itemId: layer.itemId, choice: ConfirmChoice.Cancel } as const
  return unchanged(withTopFrame(state, withLayer(frame, abandon)))
}

function pressed(state: UiState, context: KeyboardContext, keyboard: KeyboardState = context.layer.keyboard): Transition {
  const result = pressFocusedKey(keyboard)
  return result.submitted ? closeKeyboardLayer(state, result.state.value) : withKeyboard(state, context, result.state)
}

function keyboardIntent(state: UiState, context: KeyboardContext, command: LocalIntentCommand): Transition {
  const { keyboard } = context.layer
  if (DIRECTIONS.has(command.intent)) return withKeyboard(state, context, moveKeyboardFocus(keyboard, command.intent))
  switch (command.intent) {
    case Intent.Confirm:
      return pressed(state, context)
    case Intent.TabPrev:
      return withKeyboard(state, context, switchLayer(keyboard, PREVIOUS_LAYER))
    case Intent.TabNext:
      return withKeyboard(state, context, switchLayer(keyboard, NEXT_LAYER))
    case Intent.Erase:
      return withKeyboard(state, context, eraseCharacter(keyboard))
    case Intent.Space:
      return withKeyboard(state, context, insertSpace(keyboard).state)
    case Intent.Submit:
      return closeKeyboardLayer(state, keyboard.value)
    case Intent.Back:
      return askAbandon(state, context)
    default:
      return unchanged(state)
  }
}

function typed(state: UiState, context: KeyboardContext, value: unknown): Transition {
  if (typeof value !== 'string') return unchanged(state)
  const { keyboard } = context.layer
  const bounded = insertText({ ...keyboard, value: EMPTY_TEXT }, value.slice(0, TYPED_TEXT_SCAN_UNITS)).state.value
  return bounded === keyboard.value ? unchanged(state) : withKeyboard(state, context, { ...keyboard, value: bounded })
}

function keyboardContext(state: UiState): KeyboardContext | null {
  const frame = topFrameOf(state)
  const layer = frame === undefined ? undefined : topLayerOf(frame)
  return frame === undefined || layer === undefined || !isKeyboard(layer) ? null : { frame, layer }
}

function keyClicked(state: UiState, context: KeyboardContext, row: number, unit: number): Transition {
  const focused = focusKeyAt(context.layer.keyboard, row, unit)
  if (focused === null) return unchanged(state)
  return pressed(state, context, focused)
}

export const handleTextInputFocused: CommandHandler<UiCommandOf<typeof PageCommandType.TextInputFocused>> = (state, command) => {
  const layer = state.paused ? undefined : topFrameOf(state)?.layers.find(isKeyboard)
  return layer?.itemId === command.itemId ? withEffects(state, [sendToHost({ type: FromPage.TextEntry, active: true })]) : unchanged(state)
}

export const handleKeyboardLayer: CommandHandler<UiCommand> = (state, command) => {
  const context = keyboardContext(state)
  if (context === null) return unchanged(state)
  switch (command.type) {
    case PageCommandType.LocalIntent:
      return command.phase === IntentPhase.Press ? keyboardIntent(state, context, command) : unchanged(state)
    case PageCommandType.TypeText:
      return typed(state, context, command.value)
    case PageCommandType.ClickKey:
      return keyClicked(state, context, command.row, command.unit)
    default:
      return unchanged(state)
  }
}
