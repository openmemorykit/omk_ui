import { FormStatus } from '../../../../src/page/domain/form'
import { KeyboardLanguage } from '../../../../src/page/domain/keyboard-layouts'
import { PageCommandType, type UiCommand } from '../../../../src/page/domain/page-commands'
import type { Transition } from '../../../../src/page/domain/ui-effects'
import { LayerKind, type Frame, type UiState } from '../../../../src/page/domain/ui-state'
import { openKeyboard } from '../../../../src/page/domain/virtual-keyboard'
import { Intent, IntentPhase } from '../../../../src/protocol/intents'

export const FakeItem = { Throw: 'throw', Submit: 'submit', Type: 'identifier' } as const

const KEYBOARD_MAX_LENGTH = 64
const NEXT = 1

function withTop(state: UiState, change: (frame: Frame) => Frame): Transition {
  const top = state.stack[state.stack.length - 1]
  if (top === undefined) return { state, effects: [] }
  const changed = change(top)
  return { state: changed === top ? state : { ...state, stack: state.stack.slice(0, -1).concat(changed) }, effects: [] }
}

function submitted(frame: Frame, now: number): Frame {
  if (frame.form === null || frame.form.status === FormStatus.Pending) return frame
  return { ...frame, form: { ...frame.form, status: FormStatus.Pending, submissionId: frame.form.submissionId + NEXT, pendingSince: now } }
}

function typing(frame: Frame): Frame {
  if (frame.form === null || frame.layers.length > 0) return frame
  const keyboard = { kind: LayerKind.Keyboard, itemId: FakeItem.Type, initialValue: '', keyboard: openKeyboard(KeyboardLanguage.English, '', KEYBOARD_MAX_LENGTH) } as const
  return { ...frame, layers: [keyboard] }
}

function throwOnRequest(command: UiCommand): void {
  if (command.type === PageCommandType.ClickItem && command.itemId === FakeItem.Throw) throw new TypeError('fake handler failure')
}

export function fakeList(state: UiState, command: UiCommand, now: number): Transition {
  throwOnRequest(command)
  if (command.type !== PageCommandType.ClickItem) return { state, effects: [] }
  if (command.itemId === FakeItem.Submit) return withTop(state, (frame) => submitted(frame, now))
  return command.itemId === FakeItem.Type ? withTop(state, typing) : { state, effects: [] }
}

export function fakeKeyboard(state: UiState, command: UiCommand): Transition {
  throwOnRequest(command)
  const leaves = command.type === PageCommandType.LocalIntent && command.phase === IntentPhase.Press && command.intent === Intent.Back
  return leaves ? withTop(state, (frame) => ({ ...frame, layers: frame.layers.slice(0, -1) })) : { state, effects: [] }
}

export function fakeConfirm(state: UiState, command: UiCommand): Transition {
  throwOnRequest(command)
  return { state, effects: [] }
}
