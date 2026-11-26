import type { ValueOf } from '@openmemorykit/core/shared'
import { PanelKind } from '@openmemorykit/ui/contract'
import { FormStatus } from '../../domain/form'
import { FORM_SUBMIT_ROW_ID } from '../../domain/panel-rows'
import type { Frame } from '../../domain/ui-state'
import type { Translate } from '../../i18n/messages'
import { rowElementId } from './row-view'

export const SubmitState = { Ready: 'ready', Invalid: 'invalid', Pending: 'pending', Rejected: 'rejected', NoReply: 'noReply' } as const
export type SubmitState = ValueOf<typeof SubmitState>

export interface FormSubmitView {
  readonly id: string
  readonly elementId: string
  readonly label: string
  readonly focused: boolean
  readonly state: SubmitState
  readonly errorCount: number
  readonly countText: string | null
  readonly message: string | null
}

const NO_ERRORS = 0

function stateOf(frame: Frame, errorCount: number): SubmitState {
  const form = frame.form
  if (form === null) return SubmitState.Ready
  if (form.status === FormStatus.Pending) return SubmitState.Pending
  if (form.status === FormStatus.Rejected) return SubmitState.Rejected
  if (form.timedOut) return SubmitState.NoReply
  return errorCount > NO_ERRORS ? SubmitState.Invalid : SubmitState.Ready
}

function messageOf(state: SubmitState, frame: Frame, translate: Translate): string | null {
  if (state === SubmitState.NoReply) return translate('ui.form.noReply')
  return state === SubmitState.Rejected ? frame.form?.message ?? null : null
}

export function formSubmitView(frame: Frame, translate: Translate): FormSubmitView {
  const errorCount = frame.form === null ? NO_ERRORS : Object.keys(frame.form.errors).length
  const state = stateOf(frame, errorCount)
  const showsCount = errorCount > NO_ERRORS && state !== SubmitState.Pending
  const panel = frame.panel?.panel
  return Object.freeze({
    id: FORM_SUBMIT_ROW_ID,
    elementId: rowElementId(FORM_SUBMIT_ROW_ID),
    label: panel?.kind === PanelKind.Form ? panel.submitLabel : '',
    focused: frame.focusItemId === FORM_SUBMIT_ROW_ID,
    state,
    errorCount,
    countText: showsCount ? translate('ui.form.errorCount', { count: errorCount }) : null,
    message: messageOf(state, frame, translate),
  })
}
