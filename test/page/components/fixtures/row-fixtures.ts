import { BadgeTone } from '@openmemorykit/ui/contract'
import { RowKind, RowVariant, rowElementId, type RowView } from '../../../../src/page/application/views/row-view'
import { SubmitState, type FormSubmitView } from '../../../../src/page/application/views/form-submit-view'

export function rowOf(overrides: Partial<RowView> = {}): RowView {
  const id = overrides.id ?? 'row'
  return {
    id,
    elementId: rowElementId(id),
    kind: RowKind.Plain,
    label: 'Label',
    icon: null,
    focused: false,
    disabled: false,
    disabledFocused: false,
    pending: false,
    variant: RowVariant.Default,
    badge: null,
    value: null,
    on: false,
    empty: false,
    placeholder: null,
    error: null,
    ...overrides,
  }
}

export function submitOf(overrides: Partial<FormSubmitView> = {}): FormSubmitView {
  return {
    id: '__submit',
    elementId: rowElementId('__submit'),
    label: 'Send',
    focused: false,
    state: SubmitState.Ready,
    errorCount: 0,
    countText: null,
    message: null,
    ...overrides,
  }
}

export const SUCCESS_BADGE = { tone: BadgeTone.Success, label: 'Done' } as const
