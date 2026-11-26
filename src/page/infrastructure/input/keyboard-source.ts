import { Intent, IntentPhase } from '../../../protocol/intents'
import type { BindingLabels } from '../../../protocol/to-page'
import { KeyCode, KeyOutcomeKind, mapKey } from '../../domain/key-map'
import { PageCommandType } from '../../domain/page-commands'
import type { Dispatch } from '../../application/ports'
import type { Detach } from '../window-events'

export interface KeySourceState {
  readonly bindings: BindingLabels
  readonly pushToTalkCode: string | null
  readonly textFieldFocused: boolean
}

const KEY_DOWN = 'keydown'
const KEY_UP = 'keyup'

export function createKeyboardSource(target: Window, dispatch: Dispatch, read: () => KeySourceState): Detach {
  const pressed = new Map<string, Intent>()

  const sendIntent = (intent: Intent, phase: IntentPhase, fromEscape: boolean): void =>
    dispatch({ type: PageCommandType.LocalIntent, intent, phase, fromEscape })

  function onKeyDown(event: KeyboardEvent): void {
    if (event.code === KeyCode.Tab) event.preventDefault()
    if (event.repeat) return
    const state = read()
    if (event.code === state.pushToTalkCode) return
    const outcome = mapKey({ code: event.code, key: event.key, shift: event.shiftKey, inTextField: state.textFieldFocused }, state.bindings)
    if (outcome.kind === KeyOutcomeKind.PushToTalk) return
    if (outcome.kind === KeyOutcomeKind.None) {
      dispatch({ type: PageCommandType.LocalModality })
      return
    }
    pressed.set(event.code, outcome.intent)
    sendIntent(outcome.intent, IntentPhase.Press, event.code === KeyCode.Escape)
  }

  function onKeyUp(event: KeyboardEvent): void {
    const intent = pressed.get(event.code)
    if (intent !== undefined) {
      pressed.delete(event.code)
      sendIntent(intent, IntentPhase.Release, false)
    }
    if (event.code === KeyCode.Escape) dispatch({ type: PageCommandType.EscapeKeyUp })
  }

  target.addEventListener(KEY_DOWN, onKeyDown)
  target.addEventListener(KEY_UP, onKeyUp)
  return () => {
    target.removeEventListener(KEY_DOWN, onKeyDown)
    target.removeEventListener(KEY_UP, onKeyUp)
    pressed.clear()
  }
}
