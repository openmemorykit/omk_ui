import { RuleKind, type FormPanel } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { formSubmitView, SubmitState } from '../../../../src/page/application/views/form-submit-view'
import { rowElementId } from '../../../../src/page/application/views/row-view'
import { FormStatus, submitForm, type FormState } from '../../../../src/page/domain/form'
import { FORM_SUBMIT_ROW_ID } from '../../../../src/page/domain/panel-rows'
import type { Frame } from '../../../../src/page/domain/ui-state'
import { OWNED_ADD_PANEL } from '../../../fixtures/owned'
import { formState, hasFunction, isDeeplyFrozen, panelsState, topFrameOf, translate } from './column-fixtures'

const NOW = 5000
const fresh: Frame = topFrameOf(formState())

function withForm(change: (form: FormState) => FormState): Frame {
  if (fresh.form === null) throw new Error('form expected')
  return { ...fresh, form: change(fresh.form) }
}

function invalid(): Frame {
  return withForm((form) => submitForm(form, OWNED_ADD_PANEL.panel as FormPanel, NOW).state)
}

describe('formSubmitView', () => {
  it('is ready on a fresh form', () => {
    expect(formSubmitView(fresh, translate)).toMatchObject({ id: FORM_SUBMIT_ROW_ID, label: 'Add', state: SubmitState.Ready, errorCount: 0, countText: null, message: null, focused: false })
  })

  it('exposes the element id and the focus', () => {
    const view = formSubmitView({ ...fresh, focusItemId: FORM_SUBMIT_ROW_ID }, translate)
    expect(view).toMatchObject({ focused: true, elementId: rowElementId(FORM_SUBMIT_ROW_ID) })
  })

  it('says how many fields to fix, in the singular', () => {
    const view = formSubmitView(invalid(), translate)
    expect(view).toMatchObject({ state: SubmitState.Invalid, errorCount: 1, countText: '1 champ à corriger' })
  })

  it('says how many fields to fix, in the plural', () => {
    const frame = withForm((form) => ({ ...form, errors: { a: { rule: RuleKind.Required, format: null, message: null }, b: { rule: RuleKind.Required, format: null, message: null } } }))
    expect(formSubmitView(frame, translate)).toMatchObject({ errorCount: 2, countText: '2 champs à corriger' })
  })

  it('counts the same errors the form announces', () => {
    const frame = invalid()
    expect(formSubmitView(frame, translate).errorCount).toBe(Object.keys(frame.form?.errors ?? {}).length)
  })

  it('is pending while waiting for the resource', () => {
    const frame = withForm((form) => ({ ...form, status: FormStatus.Pending, pendingSince: NOW }))
    expect(formSubmitView(frame, translate)).toMatchObject({ state: SubmitState.Pending, countText: null, message: null })
  })

  it('does not count errors while pending', () => {
    const frame = withForm((form) => ({ ...form, status: FormStatus.Pending, errors: { a: { rule: null, format: null, message: 'x' } } }))
    expect(formSubmitView(frame, translate).countText).toBeNull()
  })

  it('shows the refusal message', () => {
    const frame = withForm((form) => ({ ...form, status: FormStatus.Rejected, message: 'Not allowed' }))
    expect(formSubmitView(frame, translate)).toMatchObject({ state: SubmitState.Rejected, message: 'Not allowed' })
  })

  it('shows the refusal together with the field errors', () => {
    const frame = withForm((form) => ({ ...form, status: FormStatus.Rejected, message: 'No', errors: { identifier: { rule: null, format: null, message: 'Taken' } } }))
    expect(formSubmitView(frame, translate)).toMatchObject({ message: 'No', errorCount: 1, countText: '1 champ à corriger' })
  })

  it('shows a bare refusal without message', () => {
    const frame = withForm((form) => ({ ...form, status: FormStatus.Rejected, rejectedWithoutDetail: true }))
    expect(formSubmitView(frame, translate)).toMatchObject({ state: SubmitState.Rejected, message: null })
  })

  it('says there was no reply after the timeout', () => {
    const frame = withForm((form) => ({ ...form, timedOut: true }))
    expect(formSubmitView(frame, translate)).toMatchObject({ state: SubmitState.NoReply, message: 'Pas de réponse, réessaie' })
  })

  it('has no label and is ready outside a form', () => {
    expect(formSubmitView(topFrameOf(panelsState()), translate)).toMatchObject({ label: '', state: SubmitState.Ready, errorCount: 0 })
    expect(formSubmitView({ ...fresh, panel: null, form: null }, translate).label).toBe('')
  })

  it('is deeply frozen and carries no function', () => {
    const view = formSubmitView(invalid(), translate)
    expect(isDeeplyFrozen(view)).toBe(true)
    expect(hasFunction(view)).toBe(false)
  })
})
