import { describe, expect, it } from 'vitest'
import { confirmView } from '../../../../src/page/application/views/confirm-view'
import { ABANDON_TEXT_CONTENT } from '../../../../src/page/domain/keyboard-handler'
import { ConfirmChoice, ConfirmOrigin, LayerKind, type ConfirmLayer } from '../../../../src/page/domain/ui-state'
import { hasFunction, isDeeplyFrozen, translate } from './column-fixtures'

const REQUEST: ConfirmLayer = {
  kind: LayerKind.Confirm,
  origin: ConfirmOrigin.Request,
  content: { title: 'Remove every player?', text: 'The whitelist will be empty.', confirmLabel: 'Remove', cancelLabel: 'Keep', danger: true },
  confirmId: 'whitelist/remove',
  itemId: null,
  choice: ConfirmChoice.Cancel,
}

function layer(change: Partial<ConfirmLayer>): ConfirmLayer {
  return { ...REQUEST, ...change }
}

describe('confirmView', () => {
  it('renders a danger confirmation with the cancel choice focused', () => {
    const view = confirmView(REQUEST, translate)
    expect(view).toMatchObject({ title: 'Remove every player?', text: 'The whitelist will be empty.', danger: true })
    expect(view.choices).toEqual([
      { id: ConfirmChoice.Confirm, label: 'Remove', focused: false, danger: true },
      { id: ConfirmChoice.Cancel, label: 'Keep', focused: true, danger: false },
    ])
  })

  it('renders a normal confirmation with the confirm choice focused', () => {
    const view = confirmView(layer({ choice: ConfirmChoice.Confirm, content: { title: 'T', text: 'X', confirmLabel: 'Go' } }), translate)
    expect(view.danger).toBe(false)
    expect(view.choices.map((choice) => [choice.focused, choice.danger])).toEqual([[true, false], [false, false]])
  })

  it('falls back to the translated cancel label', () => {
    const view = confirmView(layer({ content: { title: 'T', text: 'X', confirmLabel: 'Go' } }), translate)
    expect(view.choices[1]?.label).toBe('Annuler')
  })

  it('translates the abandon-text keys', () => {
    const view = confirmView(layer({ origin: ConfirmOrigin.AbandonText, content: ABANDON_TEXT_CONTENT }), translate)
    expect(view).toMatchObject({ title: 'Abandonner le texte ?', text: 'Ce que tu as saisi sera perdu.', danger: true })
    expect(view.choices.map((choice) => choice.label)).toEqual(['Abandonner', 'Continuer la saisie'])
  })

  it('keeps an unknown text of the abandon origin as written', () => {
    const view = confirmView(layer({ origin: ConfirmOrigin.AbandonText, content: { title: 'ui.abandonText.other', text: 'X', confirmLabel: 'Go' } }), translate)
    expect(view.title).toBe('ui.abandonText.other')
  })

  it('renders the text of a resource as is even when it looks like a key', () => {
    const content = { title: 'ui.abandonText.title', text: 'ui.abandonText.text', confirmLabel: 'ui.abandonText.confirm', cancelLabel: 'ui.abandonText.cancel' }
    const view = confirmView(layer({ content }), translate)
    expect([view.title, view.text, view.choices[0]?.label, view.choices[1]?.label]).toEqual(Object.values(content))
    const item = confirmView(layer({ origin: ConfirmOrigin.Item, content }), translate)
    expect(item.title).toBe('ui.abandonText.title')
  })

  it('is deeply frozen and carries no function', () => {
    const view = confirmView(REQUEST, translate)
    expect(isDeeplyFrozen(view)).toBe(true)
    expect(hasFunction(view)).toBe(false)
  })
})
