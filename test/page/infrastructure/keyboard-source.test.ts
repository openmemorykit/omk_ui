import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Intent, IntentPhase } from '../../../src/protocol/intents'
import { PageCommandType, type UiCommand } from '../../../src/page/domain/page-commands'
import { createKeyboardSource, type KeySourceState } from '../../../src/page/infrastructure/input/keyboard-source'
import { trackListeners, type ListenerLedger } from './ledger'

const BASE: KeySourceState = { bindings: { radial: 't_f', interact: 't_e', pushToTalk: 'b_170' }, pushToTalkCode: 'F1', textFieldFocused: false }
const PRESS = IntentPhase.Press
const RELEASE = IntentPhase.Release

function press(intent: Intent, phase: IntentPhase, fromEscape = false): UiCommand {
  return { type: PageCommandType.LocalIntent, intent, phase, fromEscape }
}

interface KeyInit { code: string; key?: string; shiftKey?: boolean; repeat?: boolean }

function fire(type: 'keydown' | 'keyup', init: KeyInit): KeyboardEvent {
  const event = new KeyboardEvent(type, { key: init.code, ...init, cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe('keyboard source', () => {
  let commands: UiCommand[]
  let state: KeySourceState
  let ledger: ListenerLedger
  let detach: () => void

  beforeEach(() => {
    commands = []
    state = BASE
    ledger = trackListeners(window)
    detach = createKeyboardSource(window, (command) => void commands.push(command), () => state)
  })
  afterEach(() => {
    detach()
    ledger.restore()
  })

  it.each([
    ['ArrowUp', Intent.Up], ['ArrowDown', Intent.Down], ['ArrowLeft', Intent.Left], ['ArrowRight', Intent.Right],
    ['KeyW', Intent.Up], ['KeyS', Intent.Down], ['KeyA', Intent.Left], ['KeyD', Intent.Right],
    ['KeyQ', Intent.TabPrev], ['KeyE', Intent.TabNext], ['Enter', Intent.Confirm], ['Space', Intent.Confirm],
  ])('maps %s to %s on press then release', (code, intent) => {
    fire('keydown', { code })
    fire('keyup', { code })
    expect(commands).toEqual([press(intent, PRESS), press(intent, RELEASE)])
  })

  it('maps Escape to back from escape, and its keyup to EscapeKeyUp after the release', () => {
    fire('keydown', { code: 'Escape' })
    fire('keyup', { code: 'Escape' })
    expect(commands).toEqual([press(Intent.Back, PRESS, true), press(Intent.Back, RELEASE), { type: PageCommandType.EscapeKeyUp }])
  })

  it('maps Tab and Shift+Tab, always preventing the native focus move', () => {
    const forward = fire('keydown', { code: 'Tab' })
    const backward = fire('keydown', { code: 'Tab', shiftKey: true })
    expect(commands).toEqual([press(Intent.TabNext, PRESS), press(Intent.TabPrev, PRESS)])
    expect(forward.defaultPrevented).toBe(true)
    expect(backward.defaultPrevented).toBe(true)
  })

  it.each(['ArrowDown', 'Enter', 'Space', 'KeyW'])('prevents the native action of %s once it became an intent outside a text field', (code) => {
    expect(fire('keydown', { code }).defaultPrevented).toBe(true)
  })

  it('leaves a key without intent to the browser', () => {
    expect(fire('keydown', { code: 'KeyZ', key: 'z' }).defaultPrevented).toBe(false)
  })

  it('leaves editing keys alone inside a text field', () => {
    state = { ...BASE, textFieldFocused: true }
    expect(fire('keydown', { code: 'ArrowLeft' }).defaultPrevented).toBe(false)
    expect(fire('keydown', { code: 'Enter' }).defaultPrevented).toBe(false)
  })

  it('does not take over the push-to-talk key', () => {
    expect(fire('keydown', { code: 'F1' }).defaultPrevented).toBe(false)
  })

  it('does not click a focused button twice on Enter', () => {
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    expect(fire('keydown', { code: 'Enter' }).defaultPrevented).toBe(true)
    button.remove()
  })

  it('prevents Tab even in a text field and on repeat', () => {
    state = { ...BASE, textFieldFocused: true }
    fire('keydown', { code: 'Tab' })
    const repeated = fire('keydown', { code: 'Tab', repeat: true })
    expect(repeated.defaultPrevented).toBe(true)
    expect(commands).toEqual([press(Intent.TabNext, PRESS)])
  })

  it('maps the text radial binding and ignores it in a text field', () => {
    fire('keydown', { code: 'KeyF', key: 'f' })
    expect(commands).toEqual([press(Intent.Radial, PRESS)])
    commands.length = 0
    state = { ...BASE, textFieldFocused: true }
    fire('keydown', { code: 'KeyF', key: 'f' })
    expect(commands).toEqual([{ type: PageCommandType.LocalModality }])
  })

  it.each(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space'])('has no intent for %s in a text field', (code) => {
    state = { ...BASE, textFieldFocused: true }
    fire('keydown', { code })
    fire('keyup', { code })
    expect(commands).toEqual([{ type: PageCommandType.LocalModality }])
  })

  it('keeps arrows, Enter and Escape in a text field', () => {
    state = { ...BASE, textFieldFocused: true }
    fire('keydown', { code: 'ArrowLeft' })
    fire('keydown', { code: 'Enter' })
    expect(commands).toEqual([press(Intent.Left, PRESS), press(Intent.Confirm, PRESS)])
  })

  it('gives Backspace no intent, only the modality', () => {
    fire('keydown', { code: 'Backspace' })
    fire('keyup', { code: 'Backspace' })
    expect(commands).toEqual([{ type: PageCommandType.LocalModality }])
  })

  it('ignores the push-to-talk key entirely', () => {
    fire('keydown', { code: 'F1' })
    fire('keyup', { code: 'F1' })
    expect(commands).toEqual([])
  })

  it('ignores a text push-to-talk binding', () => {
    state = { ...BASE, bindings: { ...BASE.bindings, pushToTalk: 't_v' }, pushToTalkCode: null }
    fire('keydown', { code: 'KeyV', key: 'v' })
    fire('keyup', { code: 'KeyV', key: 'v' })
    expect(commands).toEqual([])
  })

  it('ignores a repeated keydown', () => {
    fire('keydown', { code: 'ArrowDown' })
    fire('keydown', { code: 'ArrowDown', repeat: true })
    fire('keydown', { code: 'Backspace', repeat: true })
    expect(commands).toEqual([press(Intent.Down, PRESS)])
  })

  it('stops the native repeat of a key it holds, so that a focused button is not clicked again and again', () => {
    fire('keydown', { code: 'Enter' })
    const repeated = fire('keydown', { code: 'Enter', repeat: true })
    expect(repeated.defaultPrevented).toBe(true)
    expect(commands).toEqual([press(Intent.Confirm, PRESS)])
  })

  it('leaves the repeat of a key it does not hold to the page', () => {
    const repeated = fire('keydown', { code: 'KeyP', key: 'p', repeat: true })
    expect(repeated.defaultPrevented).toBe(false)
    expect(commands).toEqual([])
  })

  it('does not prevent the repeat of a key it holds once the key is released', () => {
    fire('keydown', { code: 'Enter' })
    fire('keyup', { code: 'Enter' })
    expect(fire('keydown', { code: 'Enter', repeat: true }).defaultPrevented).toBe(false)
  })

  it('releases by the code pressed even if a text field took the focus since', () => {
    fire('keydown', { code: 'KeyW' })
    state = { ...BASE, textFieldFocused: true }
    fire('keyup', { code: 'KeyW' })
    expect(commands).toEqual([press(Intent.Up, PRESS), press(Intent.Up, RELEASE)])
  })

  it('reports the modality for any other key', () => {
    fire('keydown', { code: 'KeyP', key: 'p' })
    expect(commands).toEqual([{ type: PageCommandType.LocalModality }])
  })

  it('removes every listener on detach', () => {
    expect(ledger.active()).toBeGreaterThan(0)
    detach()
    expect(ledger.active()).toBe(0)
    fire('keydown', { code: 'ArrowUp' })
    expect(commands).toEqual([])
  })
})
