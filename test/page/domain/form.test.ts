import { describe, expect, it } from 'vitest'
import { RuleKind, TextFormat, type FormPanel, type Item, MAX_REPORTED_ERRORS } from '@openmemorykit/ui/contract'
import { ADD_ACTION, IDENTIFIER_TEXT, NOTIFY_TOGGLE, PLAYERS_SECTION, ROLE_CYCLE } from '../../fixtures/items'
import { ADD_PANEL } from '../../fixtures/panels'
import {
  FormStatus,
  mergeFormOnUpdate,
  openForm,
  setFieldValue,
  checkField,
  submitForm,
  type FormState,
} from '../../../src/page/domain/form'

const NOW = 1_000
const OVERFLOW_FACTOR = 3
const OVERLONG = 200
const VALID_IDENTIFIER = 'license:ABC'
const PANEL_WITH_SECTION: FormPanel = { ...ADD_PANEL, items: [PLAYERS_SECTION, ADD_ACTION, ...ADD_PANEL.items] }

function filled(): FormState {
  return setFieldValue(openForm(ADD_PANEL), IDENTIFIER_TEXT.id, VALID_IDENTIFIER)
}

function pending(): FormState {
  return submitForm(filled(), ADD_PANEL, NOW).state
}

function manyFieldsPanel(count: number): FormPanel {
  const items: Item[] = Array.from({ length: count }, (_, index) => ({ ...IDENTIFIER_TEXT, id: `field-${String(index)}` }))
  return { ...ADD_PANEL, items }
}

describe('openForm', () => {
  it('takes initial values from the fields only', () => {
    const state = openForm(PANEL_WITH_SECTION)
    expect(Object.keys(state.values).sort()).toEqual(['identifier', 'notify', 'role'])
    expect(state.values).toEqual({ identifier: '', role: 'member', notify: false })
    expect(state).toMatchObject({
      status: FormStatus.Editing,
      submissionId: 0,
      pendingSince: null,
      message: null,
      rejectedWithoutDetail: false,
      timedOut: false,
    })
    expect(Object.keys(state.errors)).toEqual([])
  })
})

describe('setFieldValue', () => {
  it('stores a value, clears that field error and leaves the input untouched', () => {
    const open = openForm(ADD_PANEL)
    const refused = submitForm(open, ADD_PANEL, NOW).state
    const edited = setFieldValue(refused, IDENTIFIER_TEXT.id, 'x')
    expect(edited.values.identifier).toBe('x')
    expect(edited.errors.identifier).toBeUndefined()
    expect(refused.errors.identifier).toBeDefined()
    expect(open.values.identifier).toBe('')
  })

  it('ignores unknown identifiers, mistyped values and edits while pending', () => {
    const open = openForm(ADD_PANEL)
    expect(setFieldValue(open, 'ghost', 'x')).toBe(open)
    expect(setFieldValue(open, '__proto__', 'x')).toBe(open)
    expect(setFieldValue(open, 'notify', 'yes')).toBe(open)
    const waiting = pending()
    expect(setFieldValue(waiting, 'identifier', 'other')).toBe(waiting)
  })
})

describe('checkField', () => {
  it('sets then clears the error of one field', () => {
    const checked = checkField(setFieldValue(openForm(ADD_PANEL), 'identifier', 'License:abc'), IDENTIFIER_TEXT)
    expect(checked.errors.identifier).toEqual({ rule: RuleKind.Format, format: TextFormat.PlayerIdentifier, message: null })
    const fixed = checkField(setFieldValue(checked, 'identifier', 'license:abc'), IDENTIFIER_TEXT)
    expect(fixed.errors.identifier).toBeUndefined()
  })

  it('ignores items that are not fields', () => {
    const open = openForm(ADD_PANEL)
    expect(checkField(open, ADD_ACTION)).toBe(open)
  })
})

describe('submitForm', () => {
  it('refuses an invalid form, counts the errors and designates the first invalid field', () => {
    const outcome = submitForm(openForm(ADD_PANEL), ADD_PANEL, NOW)
    expect(outcome.submitted).toBeNull()
    expect(outcome.invalidCount).toBe(1)
    expect(outcome.firstInvalidId).toBe('identifier')
    expect(outcome.state.status).toBe(FormStatus.Editing)
    expect(outcome.state.submissionId).toBe(0)
    expect(outcome.state.errors.identifier?.rule).toBe(RuleKind.Required)
  })

  it('refuses a format violation such as an uppercase scheme', () => {
    const state = setFieldValue(openForm(ADD_PANEL), 'identifier', 'License:abc')
    const outcome = submitForm(state, ADD_PANEL, NOW)
    expect(outcome.submitted).toBeNull()
    expect(outcome.state.errors.identifier?.rule).toBe(RuleKind.Format)
  })

  it('sends a valid form as pending with an incremented id and normalized values', () => {
    const outcome = submitForm(filled(), ADD_PANEL, NOW)
    expect(outcome.invalidCount).toBe(0)
    expect(outcome.firstInvalidId).toBeNull()
    expect(outcome.submitted).toEqual({
      submissionId: 1,
      values: { identifier: 'license:abc', role: 'member', notify: false },
    })
    expect(outcome.state).toMatchObject({ status: FormStatus.Pending, submissionId: 1, pendingSince: NOW, message: null })
    expect(outcome.state.values.identifier).toBe(VALID_IDENTIFIER)
  })

  it('does nothing on a second submission while pending', () => {
    const waiting = pending()
    const outcome = submitForm(waiting, ADD_PANEL, NOW + 1)
    expect(outcome).toEqual({ state: waiting, submitted: null, invalidCount: 0, firstInvalidId: null })
    expect(outcome.state.submissionId).toBe(1)
  })

  it('does nothing on a non finite clock', () => {
    const outcome = submitForm(filled(), ADD_PANEL, Number.NaN)
    expect(outcome.submitted).toBeNull()
    expect(outcome.state.status).toBe(FormStatus.Editing)
  })

  it('bounds the stored errors but counts every invalid field', () => {
    const total = MAX_REPORTED_ERRORS * OVERFLOW_FACTOR
    const panel = manyFieldsPanel(total)
    const outcome = submitForm(openForm(panel), panel, NOW)
    expect(outcome.invalidCount).toBe(total)
    expect(Object.keys(outcome.state.errors)).toHaveLength(MAX_REPORTED_ERRORS)
    expect(outcome.firstInvalidId).toBe('field-0')
  })

  it('clamps an overlong text to the field maximum before sending', () => {
    const state = setFieldValue(openForm(ADD_PANEL), 'identifier', `license:${'a'.repeat(OVERLONG)}`)
    const clamped = submitForm(state, ADD_PANEL, NOW).submitted
    expect(clamped?.values.identifier).toHaveLength(IDENTIFIER_TEXT.maxLength)
  })

  it('keeps reserved names as plain data', () => {
    const panel: FormPanel = { ...ADD_PANEL, items: [{ ...IDENTIFIER_TEXT, id: 'toString' }] }
    const state = setFieldValue(openForm(panel), 'toString', 'license:a')
    expect(Object.values(submitForm(state, panel, NOW).submitted?.values ?? {})).toEqual(['license:a'])
  })
})

describe('mergeFormOnUpdate', () => {
  it('keeps the input of fields that remain and takes new ones from the panel', () => {
    const typed = setFieldValue(setFieldValue(openForm(ADD_PANEL), 'identifier', 'license:a'), 'notify', true)
    const updated: FormPanel = { ...ADD_PANEL, items: [IDENTIFIER_TEXT, { ...NOTIFY_TOGGLE, id: 'other', value: true }] }
    const merged = mergeFormOnUpdate(typed, updated)
    expect(merged.values).toEqual({ identifier: 'license:a', other: true })
  })

  it('drops errors of removed fields and keeps the others and the status', () => {
    const refused = submitForm(openForm(ADD_PANEL), ADD_PANEL, NOW).state
    const kept = mergeFormOnUpdate(refused, ADD_PANEL)
    expect(kept.errors.identifier).toBeDefined()
    const removed = mergeFormOnUpdate(refused, { ...ADD_PANEL, items: [ROLE_CYCLE] })
    expect(Object.keys(removed.errors)).toEqual([])
    const waiting = pending()
    expect(mergeFormOnUpdate(waiting, ADD_PANEL).status).toBe(FormStatus.Pending)
  })

  it('resets a value whose type changed or whose option disappeared', () => {
    const typed = setFieldValue(openForm(ADD_PANEL), 'role', 'member')
    const retyped: FormPanel = { ...ADD_PANEL, items: [{ ...NOTIFY_TOGGLE, id: 'role' }] }
    expect(mergeFormOnUpdate(typed, retyped).values.role).toBe(false)
    const narrowed: FormPanel = {
      ...ADD_PANEL,
      items: [{ ...ROLE_CYCLE, options: [{ id: 'staff', label: 'Staff' }], value: 'staff' }],
    }
    expect(mergeFormOnUpdate(typed, narrowed).values.role).toBe('staff')
  })
})
