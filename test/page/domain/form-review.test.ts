import { describe, expect, it } from 'vitest'
import { FormOutcome, MAX_REPORTED_ERRORS, RuleKind, TextFormat, type FormPanel, type FormResult, type Item } from '@openmemorykit/ui/contract'
import { IDENTIFIER_TEXT } from '../../fixtures/items'
import { ADD_PANEL } from '../../fixtures/panels'
import {
  checkField,
  expireForm,
  FORM_TIMEOUT_MS,
  mergeFormOnUpdate,
  openForm,
  ResolveOutcome,
  resolveSubmission,
  setFieldValue,
  submitForm,
  type FormState,
} from '../../../src/page/domain/form'

const NOW = 1_000
const EXTRA = 2
const ACCEPTED: FormResult = { outcome: FormOutcome.Accepted }
const HALF_OVERFLOW_FACTOR = 2

function pending(): FormState {
  return submitForm(setFieldValue(openForm(ADD_PANEL), 'identifier', 'license:ABC'), ADD_PANEL, NOW).state
}

function manyFieldsPanel(count: number): FormPanel {
  const items: Item[] = Array.from({ length: count }, (_, index) => ({ ...IDENTIFIER_TEXT, id: `field-${String(index)}` }))
  return { ...ADD_PANEL, items }
}

describe('review fixes', () => {
  const FACE = '\u{1F600}'
  const MANY = MAX_REPORTED_ERRORS + EXTRA

  it('keeps timedOut through an invalid submission so the late answer still applies', () => {
    const expired = expireForm(pending(), NOW + FORM_TIMEOUT_MS)
    const emptied = setFieldValue(expired, 'identifier', '')
    const refused = submitForm(emptied, ADD_PANEL, NOW + FORM_TIMEOUT_MS + 1)
    expect(refused.submitted).toBeNull()
    expect(refused.state.timedOut).toBe(true)
    expect(resolveSubmission(refused.state, 1, ACCEPTED)).toMatchObject({ outcome: ResolveOutcome.Applied, close: true })
  })

  it('checks every field without a cap', () => {
    const panel = manyFieldsPanel(MANY)
    const typed = panel.items.reduce((state, item) => setFieldValue(state, item.id, 'License:a'), openForm(panel))
    const checked = panel.items.reduce((state, item) => checkField(state, item), typed)
    expect(Object.keys(checked.errors)).toHaveLength(MANY)
  })

  it('treats a rejection with only unknown identifiers or an empty message as bare', () => {
    const unknown = resolveSubmission(pending(), 1, { outcome: FormOutcome.Rejected, fieldErrors: { ghost: 'Nope' } })
    expect(unknown.state.rejectedWithoutDetail).toBe(true)
    const blank = resolveSubmission(pending(), 1, { outcome: FormOutcome.Rejected, message: '' })
    expect(blank.state).toMatchObject({ rejectedWithoutDetail: true, message: null })
  })

  it('sends a blank optional text as an empty string', () => {
    const panel: FormPanel = { ...ADD_PANEL, items: [{ ...IDENTIFIER_TEXT, rules: [{ kind: RuleKind.Format, format: TextFormat.Digits }] }] }
    const state = setFieldValue(openForm(panel), 'identifier', '   ')
    expect(submitForm(state, panel, NOW).submitted?.values.identifier).toBe('')
  })

  it('cuts a merged value to a reduced maxLength without splitting a pair', () => {
    const typed = setFieldValue(openForm(ADD_PANEL), 'identifier', 'abcdef')
    const reduced = (maxLength: number): FormPanel => ({ ...ADD_PANEL, items: [{ ...IDENTIFIER_TEXT, maxLength }] })
    expect(mergeFormOnUpdate(typed, reduced(HALF_OVERFLOW_FACTOR + 1)).values.identifier).toBe('abc')
    const paired = setFieldValue(openForm(ADD_PANEL), 'identifier', `a${FACE}`)
    expect(mergeFormOnUpdate(paired, reduced(HALF_OVERFLOW_FACTOR)).values.identifier).toBe('a')
  })

  it('drops stale rule errors on merge and keeps server errors', () => {
    const refused = submitForm(openForm(ADD_PANEL), ADD_PANEL, NOW).state
    const relaxed: FormPanel = { ...ADD_PANEL, items: [{ ...IDENTIFIER_TEXT, rules: [] }] }
    expect(Object.keys(mergeFormOnUpdate(refused, relaxed).errors)).toEqual([])
    const rejected = resolveSubmission(pending(), 1, { outcome: FormOutcome.Rejected, fieldErrors: { identifier: 'Taken' } }).state
    expect(mergeFormOnUpdate(rejected, relaxed).errors.identifier?.message).toBe('Taken')
  })

  it('stores a field named __proto__ as plain data', () => {
    const panel: FormPanel = { ...ADD_PANEL, items: [{ ...IDENTIFIER_TEXT, id: '__proto__' }] }
    const state = setFieldValue(openForm(panel), '__proto__', 'license:a')
    const submitted = submitForm(state, panel, NOW).submitted
    expect(Object.keys(submitted?.values ?? {})).toEqual(['__proto__'])
    expect(Object.getPrototypeOf(submitted?.values)).toBeNull()
    expect(submitted?.values['__proto__']).toBe('license:a')
  })
})
