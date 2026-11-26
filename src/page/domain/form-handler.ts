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

function pendingDeadline(frame: Frame): number {
  return (frame.form?.pendingSince ?? Infinity) + FORM_TIMEOUT_MS
}

function earliestDeadline(stack: readonly Frame[]): number {
  return Math.min(...stack.map(pendingDeadline))
}

export function submitTopForm(state: UiState, now: number): Transition {
  const frame = topFrameOf(state)
  const owned = frame?.panel ?? null
  if (frame === undefined || owned === null || frame.form === null || owned.panel.kind !== PanelKind.Form) return unchanged(state)
  const outcome = submitForm(frame.form, owned.panel, now)
  if (outcome.submitted === null) return outcome.invalidCount === 0 ? unchanged(state) : refused(state, frame, owned, outcome)
  const next = withTopFrame(state, { ...frame, form: outcome.state })
  return withEffects(next, [replyEvent([submittedReply(owned, outcome.submitted)]), schedule(TimerKind.FormTimeout, earliestDeadline(next.stack) - now)])
}

interface ExpiredFrame { readonly frame: Frame; readonly traces: readonly UiEffect[] }

function expiredFrame(frame: Frame, now: number): ExpiredFrame {
  const kept: ExpiredFrame = { frame, traces: [] }
  const { panel, form } = frame
  if (panel === null || form === null) return kept
  const expired = expireForm(form, now)
  if (expired === form) return kept
  const data = { owner: panel.owner, panelId: panel.panel.id, submissionId: expired.submissionId }
  return { frame: { ...frame, form: expired }, traces: [sendToHost({ type: FromPage.Trace, kind: ReportKind.FormTimeout, data })] }
}

export function expireForms(state: UiState, now: number): Transition {
  const expired = state.stack.map((frame) => expiredFrame(frame, now))
  const stack = expired.map((entry) => entry.frame)
  const traces = expired.flatMap((entry) => entry.traces)
  const deadline = Number.isFinite(now) ? earliestDeadline(stack) : Infinity
  const next = traces.length === 0 ? state : { ...state, stack }
  return withEffects(next, Number.isFinite(deadline) ? traces.concat(schedule(TimerKind.FormTimeout, deadline - now)) : traces)
}
