import { Modality } from '../../src/protocol/intents'
import { ToPage, type ToPageMessage } from '../../src/protocol/to-page'
import type { Dispatch } from '../../src/page/application/ports'
import type { ConsoleMessage } from '../shell/console-api'

export const CONSOLE_FIRST_SEQ = 10_000

export function withGamepadModality(dispatch: Dispatch, modality: () => Modality): Dispatch {
  return (command) => {
    if (modality() !== Modality.Gamepad) dispatch({ type: ToPage.Modality, modality: Modality.Gamepad })
    dispatch(command)
  }
}

export function numberConsoleMessages(): (message: ConsoleMessage) => ToPageMessage {
  let next = CONSOLE_FIRST_SEQ
  return (message) => {
    if (message.type !== ToPage.Intent) return message
    const seq = next
    next += 1
    return { ...message, seq }
  }
}
