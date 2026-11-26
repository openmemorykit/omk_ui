import { ItemKind, ReplyKind, type FieldValue, type Item } from '@openmemorykit/ui/contract'
import type { OwnedReply } from '../../protocol/stack'
import { FormStatus, setFieldValue, valueOfField } from './form'
import type { FieldItem } from './form-rules'
import { NO_REPLIES } from './guards'
import type { Frame } from './ui-state'

export interface FieldChange { readonly frame: Frame; readonly replies: readonly OwnedReply[] }

export function isFormLocked(frame: Frame): boolean {
  return frame.form?.status === FormStatus.Pending
}

export function currentFieldValue(frame: Frame, item: FieldItem): FieldValue {
  const kept = frame.form === null ? undefined : valueOfField(frame.form, item.id)
  return kept ?? item.value
}

function withValue(item: Item, value: FieldValue): Item {
  switch (item.kind) {
    case ItemKind.Cycle:
    case ItemKind.Text:
      return typeof value === 'string' ? { ...item, value } : item
    case ItemKind.Toggle:
      return typeof value === 'boolean' ? { ...item, value } : item
    default:
      return item
  }
}

function withItemValue(frame: Frame, itemId: string, value: FieldValue): Frame {
  if (frame.panel === null) return frame
  const { panel } = frame.panel
  const items = panel.items.map((item) => (item.id === itemId ? withValue(item, value) : item))
  return { ...frame, panel: { ...frame.panel, panel: { ...panel, items } } }
}

export function changeField(frame: Frame, item: FieldItem, value: FieldValue): FieldChange {
  const kept: FieldChange = { frame, replies: NO_REPLIES }
  if (frame.panel === null || isFormLocked(frame) || value === currentFieldValue(frame, item)) return kept
  if (frame.form !== null) {
    const form = setFieldValue(frame.form, item.id, value)
    return form === frame.form ? kept : { frame: { ...frame, form }, replies: NO_REPLIES }
  }
  const { owner, panel } = frame.panel
  const reply: OwnedReply = { owner, reply: { kind: ReplyKind.ValueChanged, panelId: panel.id, itemId: item.id, value } }
  return { frame: withItemValue(frame, item.id, value), replies: [reply] }
}
