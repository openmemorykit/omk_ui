import type { ValueOf } from '@openmemorykit/core/shared'
import { ActionVariant, ItemKind, RuleKind, TextFormat, type IconName, type Item, type BadgeTone } from '@openmemorykit/ui/contract'
import type { FieldError } from '../../domain/form'
import { valueOfField } from '../../domain/form'
import type { Frame } from '../../domain/ui-state'
import type { MessageKey, Translate } from '../../i18n/messages'

export const RowKind = { Cycle: 'cycle', Toggle: 'toggle', Text: 'text', Plain: 'plain', Section: 'section' } as const
export type RowKind = ValueOf<typeof RowKind>

export const RowVariant = { Default: 'default', Primary: 'primary', Danger: 'danger' } as const
export type RowVariant = ValueOf<typeof RowVariant>

export interface RowBadge { readonly tone: BadgeTone; readonly label: string }

export interface RowView {
  readonly id: string
  readonly elementId: string
  readonly kind: RowKind
  readonly label: string
  readonly icon: IconName | null
  readonly focused: boolean
  readonly disabled: boolean
  readonly disabledFocused: boolean
  readonly pending: boolean
  readonly variant: RowVariant
  readonly badge: RowBadge | null
  readonly value: string | null
  readonly on: boolean
  readonly empty: boolean
  readonly placeholder: string | null
  readonly error: string | null
}

const ELEMENT_ID_PREFIX = 'omk-row-'
const NO_TEXT = ''

const FORMAT_KEYS: Readonly<Record<TextFormat, MessageKey>> = Object.freeze({
  [TextFormat.Digits]: 'ui.format.digits',
  [TextFormat.Hex]: 'ui.format.hex',
  [TextFormat.Slug]: 'ui.format.slug',
  [TextFormat.PlayerIdentifier]: 'ui.format.playerIdentifier',
})

const KIND_BY_ITEM: Readonly<Record<ItemKind, RowKind>> = Object.freeze({
  [ItemKind.Action]: RowKind.Plain,
  [ItemKind.Link]: RowKind.Plain,
  [ItemKind.Info]: RowKind.Plain,
  [ItemKind.Cycle]: RowKind.Cycle,
  [ItemKind.Toggle]: RowKind.Toggle,
  [ItemKind.Text]: RowKind.Text,
  [ItemKind.Section]: RowKind.Section,
})

export function rowElementId(itemId: string): string {
  return `${ELEMENT_ID_PREFIX}${itemId}`
}

function currentValue(item: Item, frame: Frame): unknown {
  if (frame.form === null || item.kind === ItemKind.Section) return undefined
  return valueOfField(frame.form, item.id)
}

function minimumLength(item: Item): number {
  const rules = item.kind === ItemKind.Text ? item.rules ?? [] : []
  const rule = rules.find((candidate) => candidate.kind === RuleKind.MinLength)
  return rule?.kind === RuleKind.MinLength ? rule.min : 0
}

function errorText(item: Item, error: FieldError, translate: Translate): string {
  if (error.message !== null) return error.message
  if (error.rule === RuleKind.Required) return translate('ui.rule.required')
  if (error.rule === RuleKind.MinLength) return translate('ui.rule.minLength', { min: minimumLength(item) })
  return error.format === null ? translate('ui.rule.format') : translate(FORMAT_KEYS[error.format])
}

function errorOf(item: Item, frame: Frame, translate: Translate): string | null {
  const errors = frame.form?.errors
  if (errors === undefined || !Object.prototype.hasOwnProperty.call(errors, item.id)) return null
  const error = errors[item.id]
  return error === undefined ? null : errorText(item, error, translate)
}

function displayedValue(item: Item, kept: unknown): string | null {
  switch (item.kind) {
    case ItemKind.Link:
      return item.value ?? null
    case ItemKind.Info:
      return item.value
    case ItemKind.Cycle: {
      const chosen = typeof kept === 'string' ? kept : item.value
      return item.options.find((option) => option.id === chosen)?.label ?? NO_TEXT
    }
    case ItemKind.Text:
      return typeof kept === 'string' ? kept : item.value
    default:
      return null
  }
}

function isOn(item: Item, kept: unknown): boolean {
  if (item.kind !== ItemKind.Toggle) return false
  return typeof kept === 'boolean' ? kept : item.value
}

function variantOf(item: Item): RowVariant {
  if (item.kind !== ItemKind.Action) return RowVariant.Default
  if (item.variant === ActionVariant.Primary) return RowVariant.Primary
  return item.variant === ActionVariant.Danger ? RowVariant.Danger : RowVariant.Default
}

function badgeOf(item: Item): RowBadge | null {
  const badge = item.kind === ItemKind.Link || item.kind === ItemKind.Info ? item.badge : undefined
  return badge === undefined ? null : Object.freeze({ tone: badge.tone, label: badge.label })
}

function isPending(item: Item, frame: Frame): boolean {
  return frame.pendingItemId === item.id || (item.kind === ItemKind.Action && item.busy === true)
}

export function rowView(item: Item, frame: Frame, translate: Translate): RowView {
  const kept = currentValue(item, frame)
  const focused = frame.focusItemId === item.id
  const disabled = item.kind !== ItemKind.Section && item.disabled !== undefined
  const value = displayedValue(item, kept)
  return Object.freeze({
    id: item.id,
    elementId: rowElementId(item.id),
    kind: KIND_BY_ITEM[item.kind],
    label: item.label,
    icon: item.kind === ItemKind.Section ? null : item.icon ?? null,
    focused,
    disabled,
    disabledFocused: disabled && focused,
    pending: isPending(item, frame),
    variant: variantOf(item),
    badge: badgeOf(item),
    value,
    on: isOn(item, kept),
    empty: item.kind === ItemKind.Text && value === NO_TEXT,
    placeholder: item.kind === ItemKind.Text ? item.placeholder ?? null : null,
    error: errorOf(item, frame, translate),
  })
}
