import { describe, expect, it } from 'vitest'
import { InputSource, Intent, IntentPhase, Modality } from '../../../src/protocol/intents'
import { ToPage } from '../../../src/protocol/to-page'
import { PageCommandType, type UiCommand } from '../../../src/page/domain/page-commands'
import { CONSOLE_FIRST_SEQ, numberConsoleMessages, withGamepadModality } from '../../../preview/input/preview-dispatch'

const padIntent: UiCommand = { type: PageCommandType.LocalIntent, intent: Intent.Down, phase: IntentPhase.Press, fromEscape: false }
const stick: UiCommand = { type: ToPage.Stick, x: 0.5, y: 0 }
const SWITCH: UiCommand = { type: ToPage.Modality, modality: Modality.Gamepad }

function recorded(): { commands: UiCommand[]; dispatch: (command: UiCommand) => void } {
  const commands: UiCommand[] = []
  return { commands, dispatch: (command) => void commands.push(command) }
}

describe('withGamepadModality', () => {
  it('switches the modality to the gamepad before the first gesture of the pad', () => {
    const { commands, dispatch } = recorded()
    withGamepadModality(dispatch, () => Modality.KeyboardMouse)(padIntent)
    expect(commands).toEqual([SWITCH, padIntent])
  })

  it('switches again for a stick gesture after the mouse took the modality back', () => {
    const { commands, dispatch } = recorded()
    const gesture = withGamepadModality(dispatch, () => Modality.KeyboardMouse)
    gesture(stick)
    gesture(stick)
    expect(commands).toEqual([SWITCH, stick, SWITCH, stick])
  })

  it('does not switch when the modality already is the gamepad', () => {
    const { commands, dispatch } = recorded()
    withGamepadModality(dispatch, () => Modality.Gamepad)(padIntent)
    expect(commands).toEqual([padIntent])
  })
})

describe('numberConsoleMessages', () => {
  const intent = { type: ToPage.Intent, intent: Intent.Confirm, phase: IntentPhase.Press, source: InputSource.Console } as const

  it('gives every console intent the next sequence number, from the first console number', () => {
    const number = numberConsoleMessages()
    expect(number(intent)).toEqual({ ...intent, seq: CONSOLE_FIRST_SEQ })
    expect(number({ ...intent, phase: IntentPhase.Release })).toEqual({ ...intent, phase: IntentPhase.Release, seq: CONSOLE_FIRST_SEQ + 1 })
  })

  it('leaves a stick message without number and does not consume one', () => {
    const number = numberConsoleMessages()
    const message = { type: ToPage.Stick, x: 1, y: -1 } as const
    expect(number(message)).toBe(message)
    expect(number(intent)).toMatchObject({ seq: CONSOLE_FIRST_SEQ })
  })

  it('counts independently for each numbering', () => {
    expect(numberConsoleMessages()(intent)).toMatchObject({ seq: CONSOLE_FIRST_SEQ })
    expect(numberConsoleMessages()(intent)).toMatchObject({ seq: CONSOLE_FIRST_SEQ })
  })
})
