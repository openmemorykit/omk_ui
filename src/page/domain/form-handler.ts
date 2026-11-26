import { PanelKind, ReplyKind } from '@openmemorykit/ui/contract'
import { FromPage } from '../../protocol/from-page'
import type { OwnedPanel } from '../../protocol/owned'
import type { OwnedReply } from '../../protocol/stack'
import { ReportKind } from '../../shared/report/report-kind'
import { expireForm, FORM_TIMEOUT_MS, FormStatus, submitForm, type FormState, type SubmitOutcome } from './form'
import { replyEvent, topFrameOf, withTopFrame } from './frame-updates'
import { TimerKind } from './page-commands'
import { rowWindowStart } from './panel-rows'
import { Announcement, schedule, sendToHost, unchanged, UiEffectType, withEffects, type Transition, type UiEffect } from './ui-effects'
import type { Frame, UiState } from './ui-state'

export { FORM_SUBMIT_ROW_ID } from './panel-rows'

export function formErrorsEffect(panelId: string, count: number): UiEffect {
  return { type: UiEffectType.Announce, announcement: Announcement.FormErrors, params: { panelId, count } }
}

export function rejectionEffects(form: FormState, panelId: string): readonly UiEffect[] {
  return form.status === FormStatus.Rejected ? [formErrorsEffect(panelId, Object.keys(form.errors).length)] : []
}

function submittedReply(owned: OwnedPanel, submitted: NonNullable<SubmitOutcome['submitted']>): OwnedReply {
  return { owner: owned.owner, reply: { kind: ReplyKind.FormSubmitted, panelId: owned.panel.id, submissionId: submitted.submissionId, values: submitted.values } }
}

function refused(state: UiState, frame: Frame, owned: OwnedPanel, outcome: SubmitOutcome): Transition {
  const focusItemId = outcome.firstInvalidId ?? frame.focusItemId
  const visibleStart = rowWindowStart(owned.panel, focusItemId, frame.visibleStart)
  const next = withTopFrame(state, { ...frame, form: outcome.state, focusItemId, visibleStart })
  return withEffects(next, [formErrorsEffect(owned.panel.id, outcome.invalidCount)])
}

export function submitTopForm(state: UiState, now: number): Transition {
  const frame = topFrameOf(state)
  const owned = frame?.panel ?? null
  if (frame === undefined || owned === null || frame.form === null || owned.panel.kind !== PanelKind.Form) return unchanged(state)
  const outcome = submitForm(frame.form, owned.panel, now)
  if (outcome.submitted === null) return outcome.invalidCount === 0 ? unchanged(state) : refused(state, frame, owned, outcome)
  const next = withTopFrame(state, { ...frame, form: outcome.state })
  return withEffects(next, [replyEvent([submittedReply(owned, outcome.submitted)]), schedule(TimerKind.FormTimeout, FORM_TIMEOUT_MS)])
}

function expiredFrame(frame: Frame, now: number): Frame {
  if (frame.form === null) return frame
  const form = expireForm(frame.form, now)
  return form === frame.form ? frame : { ...frame, form }
}

function timeoutTrace(frame: Frame): readonly UiEffect[] {
  if (frame.panel === null || frame.form === null) return []
  const data = { owner: frame.panel.owner, panelId: frame.panel.panel.id, submissionId: frame.form.submissionId }
  return [sendToHost({ type: FromPage.Trace, kind: ReportKind.FormTimeout, data })]
}

function nextDeadline(stack: readonly Frame[]): number | null {
  return stack.reduce<number | null>((earliest, frame) => {
    const since = frame.form?.status === FormStatus.Pending ? frame.form.pendingSince : null
    if (since === null) return earliest
    const deadline = since + FORM_TIMEOUT_MS
    return earliest === null || deadline < earliest ? deadline : earliest
  }, null)
}

export function expireForms(state: UiState, now: number): Transition {
  const stack = state.stack.map((frame) => expiredFrame(frame, now))
  const traces = stack.flatMap((frame, index) => (frame === state.stack[index] ? [] : timeoutTrace(frame)))
  const deadline = Number.isFinite(now) ? nextDeadline(stack) : null
  const next = traces.length === 0 ? state : { ...state, stack }
  return withEffects(next, deadline === null ? traces : traces.concat(schedule(TimerKind.FormTimeout, deadline - now)))
}
