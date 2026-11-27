import { describe, expect, it } from 'vitest'
import { transition } from '../../../../src/page/domain/intent-engine'
import { setFieldValue } from '../../../../src/page/domain/form'
import { withTopFrame } from '../../../../src/page/domain/frame-updates'
import { LayerKind, createInitialState, type UiState } from '../../../../src/page/domain/ui-state'
import { Intent } from '../../../../src/protocol/intents'
import { IDENTIFIER_FIELD_MAX_LENGTH } from '../../../fixtures/items'
import { OWNED_ADD_PANEL, OWNED_LIST_PANEL } from '../../../fixtures/owned'
import { NOW, press, run, withPanels } from './engine-helpers'
import { NOTE_MENU, topFrame, typeText } from './handler-helpers'

function keyboardValue(state: UiState): string | null {
  const layer = topFrame(state).layers.find((candidate) => candidate.kind === LayerKind.Keyboard)
  return layer?.kind === LayerKind.Keyboard ? layer.keyboard.value : null
}

describe('keyboard layer guards', () => {
  it('keeps the very same state when a key press adds nothing because the field is full', () => {
    const full = run(withPanels([NOTE_MENU]), [press(Intent.Confirm), typeText('x'.repeat(IDENTIFIER_FIELD_MAX_LENGTH))]).state
    const next = transition(full, press(Intent.Confirm), NOW)
    expect(next.effects).toEqual([])
    expect(next.state.stack).toBe(full.stack)
  })

  it('opens empty when the value kept by the form is not text', () => {
    const opened = withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL])
    const frame = topFrame(opened)
    if (frame.form === null) throw new Error('form expected')
    const hostile = withTopFrame(opened, { ...frame, form: setFieldValue(frame.form, 'identifier', true) })
    expect(keyboardValue(run(hostile, [press(Intent.Confirm)]).state)).toBe('')
  })
})

describe('withTopFrame', () => {
  it('leaves an empty stack alone', () => {
    const state = createInitialState()
    expect(withTopFrame(state, topFrame(withPanels([OWNED_LIST_PANEL])))).toBe(state)
  })
})
