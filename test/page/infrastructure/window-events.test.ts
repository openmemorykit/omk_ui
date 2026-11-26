import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PageCommandType, type UiCommand } from '../../../src/page/domain/page-commands'
import { createWindowEvents } from '../../../src/page/infrastructure/window-events'
import { trackListeners, type ListenerLedger } from './ledger'

describe('window events', () => {
  let commands: UiCommand[]
  let ledger: ListenerLedger
  let detach: () => void

  beforeEach(() => {
    commands = []
    ledger = trackListeners(window)
    detach = createWindowEvents(window, (command) => void commands.push(command))
  })
  afterEach(() => {
    detach()
    ledger.restore()
  })

  it('maps blur and focus to WindowBlurred and WindowFocused', () => {
    window.dispatchEvent(new Event('blur'))
    window.dispatchEvent(new Event('focus'))
    expect(commands).toEqual([{ type: PageCommandType.WindowBlurred }, { type: PageCommandType.WindowFocused }])
  })

  it('removes every listener on detach', () => {
    detach()
    expect(ledger.active()).toBe(0)
    window.dispatchEvent(new Event('blur'))
    expect(commands).toEqual([])
  })
})
