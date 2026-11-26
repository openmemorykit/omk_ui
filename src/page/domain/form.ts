import type { ValueOf } from '@openmemorykit/core/shared'
import { FormOutcome, ItemKind, MAX_REPORTED_ERRORS, type FieldValue, type FormPanel, type FormResult, type Item } from '@openmemorykit/ui/contract'
import { boundedText, isFieldItem, sentValue, validateField, type FieldError, type FieldItem } from './form-rules'

export type { FieldError } from './form-rules'

export const FormStatus = { Editing: 'editing', Pending: 'pending', Rejected: 'rejected' } as const
export type FormStatus = ValueOf<typeof FormStatus>

export const ResolveOutcome = { Applied: 'applied', Ignored: 'ignored' } as const
export type ResolveOutcome = ValueOf<typeof ResolveOutcome>

export const FORM_TIMEOUT_MS = 10000

export interface FormState {
  readonly status: FormStatus
  readonly values: Readonly<Record<string, FieldValue>>
  readonly errors: Readonly<Record<string, FieldError>>
  readonly submissionId: number
  readonly pendingSince: number | null
  readonly message: string | null
  readonly rejectedWithoutDetail: boolean
  readonly timedOut: boolean
}

export interface SubmitOutcome {
  readonly state: FormState
  readonly submitted: { readonly submissionId: number; readonly values: Readonly<Record<string, FieldValue>> } | null
  readonly invalidCount: number
  readonly firstInvalidId: string | null
}

export interface ResolveResult {
  readonly state: FormState
  readonly outcome: ResolveOutcome
  readonly close: boolean
}

const FIRST_SUBMISSION = 0
const NO_COUNT = 0
const NEXT = 1

function recordOf<Value>(entries: Iterable<readonly [string, Value]>): Readonly<Record<string, Value>> {
  const record: Record<string, Value> = Object.create(null) as Record<string, Value>
  for (const [key, value] of entries) record[key] = value
  return Object.freeze(record)
}

function has(record: Readonly<Record<string, unknown>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function sameType(first: FieldValue, second: FieldValue): boolean {
  return typeof first === typeof second
}

function fieldsOf(panel: FormPanel): readonly FieldItem[] {
  return panel.items.filter(isFieldItem)
}

function isKnownOption(field: FieldItem, value: FieldValue): boolean {
  return field.kind !== ItemKind.Cycle || field.options.some((option) => option.id === value)
}

function currentValue(state: FormState, field: FieldItem): FieldValue {
  const kept = has(state.values, field.id) ? state.values[field.id] : undefined
  const usable = kept !== undefined && sameType(kept, field.value) && isKnownOption(field, kept)
  return usable ? kept : field.value
}

export function openForm(panel: FormPanel): FormState {
  return {
    status: FormStatus.Editing,
    values: recordOf(fieldsOf(panel).map((field) => [field.id, field.value] as const)),
    errors: recordOf<FieldError>([]),
    submissionId: FIRST_SUBMISSION,
    pendingSince: null,
    message: null,
    rejectedWithoutDetail: false,
    timedOut: false,
  }
}

function withoutKey<Value>(record: Readonly<Record<string, Value>>, key: string): Readonly<Record<string, Value>> {
  return recordOf(Object.entries(record).filter(([name]) => name !== key))
}

export function valueOfField(state: FormState, itemId: string): FieldValue | undefined {
  return has(state.values, itemId) ? state.values[itemId] : undefined
}

export function setFieldValue(state: FormState, itemId: string, value: FieldValue): FormState {
  const current = valueOfField(state, itemId)
  if (state.status === FormStatus.Pending || current === undefined || !sameType(current, value)) return state
  const values = recordOf(Object.entries(state.values).map(([name, kept]) => [name, name === itemId ? value : kept] as const))
  return { ...state, values, errors: withoutKey(state.errors, itemId) }
}

export function checkField(state: FormState, item: Item): FormState {
  const current = isFieldItem(item) ? valueOfField(state, item.id) : undefined
  if (!isFieldItem(item) || current === undefined) return state
  const error = validateField(item, current)
  const others = withoutKey(state.errors, item.id)
  if (error === null) return { ...state, errors: others }
  return { ...state, errors: recordOf([...Object.entries(others), [item.id, error] as const]) }
}

function notSubmitted(state: FormState): SubmitOutcome {
  return { state, submitted: null, invalidCount: NO_COUNT, firstInvalidId: null }
}

export function submitForm(state: FormState, panel: FormPanel, now: number): SubmitOutcome {
  if (state.status === FormStatus.Pending || !Number.isFinite(now)) return notSubmitted(state)
  const errors: Array<readonly [string, FieldError]> = []
  const sent: Array<readonly [string, FieldValue]> = []
  let invalidCount = NO_COUNT
  let firstInvalidId: string | null = null
  for (const field of fieldsOf(panel)) {
    const value = currentValue(state, field)
    const error = validateField(field, value)
    if (error === null) {
      sent.push([field.id, sentValue(field, value)])
      continue
    }
    invalidCount += NEXT
    firstInvalidId ??= field.id
    if (errors.length < MAX_REPORTED_ERRORS) errors.push([field.id, error])
  }
  const values = recordOf(fieldsOf(panel).map((field) => [field.id, currentValue(state, field)] as const))
  const reset = { values, message: null, rejectedWithoutDetail: false }
  if (invalidCount > NO_COUNT) {
    return { state: { ...state, ...reset, status: FormStatus.Editing, errors: recordOf(errors) }, submitted: null, invalidCount, firstInvalidId }
  }
  const submissionId = state.submissionId + NEXT
  const next = { ...state, ...reset, timedOut: false, status: FormStatus.Pending, errors: recordOf<FieldError>([]), submissionId, pendingSince: now }
  return { state: next, submitted: { submissionId, values: recordOf(sent) }, invalidCount, firstInvalidId }
}

function settled(state: FormState): FormState {
  return { ...state, status: FormStatus.Editing, pendingSince: null, timedOut: false, message: null, rejectedWithoutDetail: false, errors: recordOf<FieldError>([]) }
}

function appliedErrors(state: FormState, fieldErrors: Readonly<Record<string, string>>): readonly (readonly [string, FieldError])[] {
  return Object.entries(fieldErrors)
    .filter(([id]) => has(state.values, id))
    .slice(NO_COUNT, MAX_REPORTED_ERRORS)
    .map(([id, message]) => [id, { rule: null, format: null, message }] as const)
}

function rejected(state: FormState, result: Extract<FormResult, { readonly outcome: typeof FormOutcome.Rejected }>): FormState {
  const errors = recordOf(appliedErrors(state, result.fieldErrors ?? {}))
  const message = result.message === undefined || result.message.length === NO_COUNT ? null : result.message
  const bare = message === null && Object.keys(errors).length === NO_COUNT
  return { ...settled(state), status: FormStatus.Rejected, errors, message, rejectedWithoutDetail: bare }
}

export function resolveSubmission(state: FormState, submissionId: number, result: FormResult): ResolveResult {
  const awaiting = state.status === FormStatus.Pending || state.timedOut
  if (!awaiting || submissionId !== state.submissionId) return { state, outcome: ResolveOutcome.Ignored, close: false }
  if (result.outcome === FormOutcome.Accepted) {
    return { state: settled(state), outcome: ResolveOutcome.Applied, close: result.keepOpen !== true }
  }
  return { state: rejected(state, result), outcome: ResolveOutcome.Applied, close: false }
}

export function expireForm(state: FormState, now: number): FormState {
  const since = state.pendingSince
  if (state.status !== FormStatus.Pending || since === null || !(now - since >= FORM_TIMEOUT_MS)) return state
  return { ...state, status: FormStatus.Editing, pendingSince: null, timedOut: true }
}

function mergedError(state: FormState, field: FieldItem, value: FieldValue): readonly (readonly [string, FieldError])[] {
  if (!has(state.errors, field.id)) return []
  const kept = state.errors[field.id]
  if (kept === undefined) return []
  if (kept.rule === null) return [[field.id, kept]]
  const fresh = validateField(field, value)
  return fresh === null ? [] : [[field.id, fresh]]
}

export function mergeFormOnUpdate(state: FormState, panel: FormPanel): FormState {
  const merged = fieldsOf(panel).map((field) => {
    const kept = currentValue(state, field)
    const value = field.kind === ItemKind.Text && typeof kept === typeof field.value ? boundedText(field, kept as string) : kept
    return { field, value }
  })
  const values = recordOf(merged.map(({ field, value }) => [field.id, value] as const))
  const errors = recordOf(merged.flatMap(({ field, value }) => mergedError(state, field, value)))
  return { ...state, values, errors }
}
