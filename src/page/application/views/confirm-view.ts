import type { ValueOf } from '@openmemorykit/core/shared'
import { ConfirmChoice, ConfirmOrigin, type ConfirmLayer } from '../../domain/ui-state'
import type { MessageKey, Translate } from '../../i18n/messages'

export interface ChoiceView {
  readonly id: ValueOf<typeof ConfirmChoice>
  readonly label: string
  readonly focused: boolean
  readonly danger: boolean
}

export interface ConfirmView {
  readonly title: string
  readonly text: string
  readonly danger: boolean
  readonly choices: readonly ChoiceView[]
}

const ABANDON_KEYS: ReadonlyMap<string, MessageKey> = new Map<string, MessageKey>([
  ['ui.abandonText.title', 'ui.abandonText.title'],
  ['ui.abandonText.text', 'ui.abandonText.text'],
  ['ui.abandonText.confirm', 'ui.abandonText.confirm'],
  ['ui.abandonText.cancel', 'ui.abandonText.cancel'],
])

function shown(text: string, layer: ConfirmLayer, translate: Translate): string {
  if (layer.origin !== ConfirmOrigin.AbandonText) return text
  const key = ABANDON_KEYS.get(text)
  return key === undefined ? text : translate(key)
}

export function confirmView(layer: ConfirmLayer, translate: Translate): ConfirmView {
  const { content } = layer
  const danger = content.danger === true
  const cancelLabel = content.cancelLabel === undefined ? translate('ui.confirm.cancel') : shown(content.cancelLabel, layer, translate)
  return Object.freeze({
    title: shown(content.title, layer, translate),
    text: shown(content.text, layer, translate),
    danger,
    choices: Object.freeze([
      Object.freeze({ id: ConfirmChoice.Confirm, label: shown(content.confirmLabel, layer, translate), focused: layer.choice === ConfirmChoice.Confirm, danger }),
      Object.freeze({ id: ConfirmChoice.Cancel, label: cancelLabel, focused: layer.choice === ConfirmChoice.Cancel, danger: false }),
    ]),
  })
}
