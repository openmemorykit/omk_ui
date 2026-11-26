import { describe, expect, it } from 'vitest'
import { FormOutcome, MAX_REPORTED_ERRORS, type FormPanel, type FormResult, type Item } from '@openmemorykit/ui/contract'
import { IDENTIFIER_TEXT } from '../../fixtures/items'
import { ADD_PANEL } from '../../fixtures/panels'
import {
  expireForm,
  FORM_TIMEOUT_MS,
  FormStatus,
  openForm,
  resolveSubmission,
  ResolveOutcome,
  setFieldValue,
  submitForm,
  type FormState,
} from '../../../src/page/domain/form'

const NOW = 1_000
const HALF_OVERFLOW_FACTOR = 2
const OLDER = 0
const NEWER = 2
const VALID_IDENTIFIER = 'license:ABC'
const ACCEPTED: FormResult = { outcome: FormOutcome.Accepted }

function pending(): FormState {
  return submitForm(setFieldValue(openForm(ADD_PANEL), IDENTIFIER_TEXT.id, VALID_IDENTIFIER), ADD_PANEL, NOW).state
}

function manyFieldsPanel(count: number): FormPanel {
  const items: Item[] = Array.from({ length: count }, (_, index) => ({ ...IDENTIFIER_TEXT, id: `field-${String(index)}` }))
  return { ...ADD_PANEL, items }
}

describe('resolveSubmission', () => {
  it('closes on acceptance and keeps the form open with keepOpen', () => {
    const closing = resolveSubmission(pending(), 1, ACCEPTED)
    expect(closing).toMatchObject({ outcome: ResolveOutcome.Applied, close: true })
    expect(closing.state.status).toBe(FormStatus.Editing)
    expect(closing.state.pendingSince).toBeNull()
    const kept = resolveSubmission(pending(), 1, { outcome: FormOutcome.Accepted, keepOpen: true })
    expect(kept).toMatchObject({ outcome: ResolveOutcome.Applied, close: false })
    expect(kept.state.status).toBe(FormStatus.Editing)
  })

  it('applies field errors and message on rejection and ignores unknown identifiers', () => {
    const result: FormResult = {
      outcome: FormOutcome.Rejected,
      fieldErrors: { identifier: 'Already allowed', ghost: 'Nope', __proto__: 'Nope' },
      message: 'Refused',
    }
    const resolved = resolveSubmission(pending(), 1, result)
    expect(resolved).toMatchObject({ outcome: ResolveOutcome.Applied, close: false })
    expect(resolved.state).toMatchObject({ status: FormStatus.Rejected, message: 'Refused', rejectedWithoutDetail: false, pendingSince: null })
    expect(resolved.state.errors).toEqual({ identifier: { rule: null, format: null, message: 'Already allowed' } })
  })

  it('flags a bare rejection', () => {
    const resolved = resolveSubmission(pending(), 1, { outcome: FormOutcome.Rejected })
    expect(resolved.state).toMatchObject({ status: FormStatus.Rejected, message: null, rejectedWithoutDetail: true })
    const empty = resolveSubmission(pending(), 1, { outcome: FormOutcome.Rejected, fieldErrors: {} })
    expect(empty.state.rejectedWithoutDetail).toBe(true)
    const detailed = resolveSubmission(pending(), 1, { outcome: FormOutcome.Rejected, message: 'No' })
    expect(detailed.state.rejectedWithoutDetail).toBe(false)
  })

  it('bounds the applied field errors', () => {
    const panel = manyFieldsPanel(MAX_REPORTED_ERRORS * HALF_OVERFLOW_FACTOR)
    const values = Object.fromEntries(panel.items.map((item) => [item.id, 'license:a']))
    const sent = Object.keys(values).reduce((state, id) => setFieldValue(state, id, 'license:a'), openForm(panel))
    const waiting = submitForm(sent, panel, NOW).state
    const fieldErrors = Object.fromEntries(Object.keys(values).map((id) => [id, 'Bad']))
    const resolved = resolveSubmission(waiting, 1, { outcome: FormOutcome.Rejected, fieldErrors })
    expect(Object.keys(resolved.state.errors)).toHaveLength(MAX_REPORTED_ERRORS)
  })

  it('ignores a response for an older submission or when nothing is pending', () => {
    const waiting = pending()
    expect(resolveSubmission(waiting, OLDER, ACCEPTED)).toEqual({ state: waiting, outcome: ResolveOutcome.Ignored, close: false })
    expect(resolveSubmission(waiting, NEWER, ACCEPTED).outcome).toBe(ResolveOutcome.Ignored)
    const idle = openForm(ADD_PANEL)
    expect(resolveSubmission(idle, 0, ACCEPTED).outcome).toBe(ResolveOutcome.Ignored)
    const settled = resolveSubmission(waiting, 1, ACCEPTED).state
    expect(resolveSubmission(settled, 1, ACCEPTED).outcome).toBe(ResolveOutcome.Ignored)
  })
})

describe('expireForm', () => {
  it('returns to editing once the delay has elapsed', () => {
    const waiting = pending()
    expect(expireForm(waiting, NOW + FORM_TIMEOUT_MS - 1)).toBe(waiting)
    const expired = expireForm(waiting, NOW + FORM_TIMEOUT_MS)
    expect(expired).toMatchObject({ status: FormStatus.Editing, timedOut: true, pendingSince: null, submissionId: 1 })
  })

  it('leaves a form that is not pending alone', () => {
    const open = openForm(ADD_PANEL)
    expect(expireForm(open, NOW + FORM_TIMEOUT_MS * HALF_OVERFLOW_FACTOR)).toBe(open)
  })

  it('applies a late response for the last submission only', () => {
    const expired = expireForm(pending(), NOW + FORM_TIMEOUT_MS)
    const late = resolveSubmission(expired, 1, ACCEPTED)
    expect(late).toMatchObject({ outcome: ResolveOutcome.Applied, close: true })
    expect(late.state.timedOut).toBe(false)
    const resubmitted = submitForm(expired, ADD_PANEL, NOW + FORM_TIMEOUT_MS + 1).state
    expect(resolveSubmission(resubmitted, 1, ACCEPTED).outcome).toBe(ResolveOutcome.Ignored)
    expect(resolveSubmission(resubmitted, NEWER, ACCEPTED).outcome).toBe(ResolveOutcome.Applied)
  })
})
