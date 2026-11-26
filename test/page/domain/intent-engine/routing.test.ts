import { beforeEach, describe, expect, it, vi } from 'vitest'
import { transition } from '../../../../src/page/domain/intent-engine'
import { PageCommandType, TimerKind, type UiCommand } from '../../../../src/page/domain/page-commands'
import { handleConfirmLayer, handleKeyboardLayer, handleList } from '../../../../src/page/domain/panel-handlers'
import { openKeyboard } from '../../../../src/page/domain/virtual-keyboard'
import { KeyboardLanguage } from '../../../../src/page/domain/keyboard-layouts'
import { LayerKind, type UiState } from '../../../../src/page/domain/ui-state'
import { Intent } from '../../../../src/protocol/intents'
import { ToPage } from '../../../../src/protocol/to-page'
import { OWNED_ADD_PANEL, OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM, OWNED_WHITELIST_RADIAL_ENTRY } from '../../../fixtures/owned'
import { NOW, OPEN_RADIAL, press, radialEntries, run, timerFired, withPanels } from './engine-helpers'

vi.mock('../../../../src/page/domain/panel-handlers', () => {
  const passThrough = (state: UiState): { readonly state: UiState; readonly effects: readonly [] } => ({ state, effects: [] })
  return { handleList: vi.fn(passThrough), handleConfirmLayer: vi.fn(passThrough), handleKeyboardLayer: vi.fn(passThrough) }
})

const KEYBOARD_MAX_LENGTH = 64
const NEXT_SEQ = 3
const PAGE_INPUTS: readonly UiCommand[] = [
  press(Intent.Down),
  { type: PageCommandType.HoverItem, itemId: 'add' },
  { type: PageCommandType.ClickItem, itemId: 'add' },
  { type: PageCommandType.TypeText, value: 'a' },
]

function withKeyboardLayer(): UiState {
  const state = withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL])
  const top = state.stack[1]
  if (top === undefined) throw new Error('frame expected')
  const keyboard = { kind: LayerKind.Keyboard, itemId: 'identifier', initialValue: '', keyboard: openKeyboard(KeyboardLanguage.English, '', KEYBOARD_MAX_LENGTH) } as const
  return { ...state, stack: [state.stack[0] ?? top, { ...top, layers: [keyboard] }] }
}

function withConfirmLayer(): UiState {
  return run(withPanels([OWNED_LIST_PANEL]), [{ type: ToPage.ShowConfirm, commandSeq: NEXT_SEQ, confirm: OWNED_REMOVE_CONFIRM }]).state
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('input routing in Panels', () => {
  it('gives every page input to the list when no layer is on top', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    PAGE_INPUTS.forEach((command) => {
      expect(transition(state, command, NOW).state.stack).toBe(state.stack)
    })
    expect(handleList).toHaveBeenCalledTimes(PAGE_INPUTS.length)
    expect(handleConfirmLayer).not.toHaveBeenCalled()
  })

  it('gives page inputs to the confirmation layer on top before the list', () => {
    run(withConfirmLayer(), PAGE_INPUTS)
    expect(handleConfirmLayer).toHaveBeenCalledTimes(PAGE_INPUTS.length)
    expect(handleList).not.toHaveBeenCalled()
  })

  it('gives page inputs to the keyboard layer on top', () => {
    run(withKeyboardLayer(), PAGE_INPUTS)
    expect(handleKeyboardLayer).toHaveBeenCalledTimes(PAGE_INPUTS.length)
    expect(handleList).not.toHaveBeenCalled()
  })

  it('passes the form and link timers to the list handler', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    const timers = [timerFired(TimerKind.FormTimeout), timerFired(TimerKind.LinkPending)]
    run(state, timers)
    expect(handleList).toHaveBeenCalledTimes(timers.length)
  })
})

describe('input routing order', () => {
  it('lets the radial take intents before any layer of the panels behind it', () => {
    const state = run(withConfirmLayer(), [radialEntries([OWNED_WHITELIST_RADIAL_ENTRY]), OPEN_RADIAL, press(Intent.Up)]).state
    expect(state.radial.childIndex).toBe(0)
    expect(handleConfirmLayer).not.toHaveBeenCalled()
  })

  it('gives nothing to the panels while the page is paused', () => {
    run(withPanels([OWNED_LIST_PANEL]), [{ type: PageCommandType.WindowBlurred }, ...PAGE_INPUTS])
    expect(handleList).not.toHaveBeenCalled()
  })
})
