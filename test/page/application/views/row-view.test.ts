import { ActionVariant, BadgeTone, ItemKind, PanelKind, RuleKind, TextFormat, type Item } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { checkField, setFieldValue, submitForm, type FormState } from '../../../../src/page/domain/form'
import type { Frame } from '../../../../src/page/domain/ui-state'
import { RowKind, RowVariant, rowElementId, rowView } from '../../../../src/page/application/views/row-view'
import { ADD_ACTION, COUNT_INFO, ENABLED_TOGGLE, IDENTIFIER_TEXT, NOTIFY_TOGGLE, PLAYER_LINK, PLAYERS_SECTION, PURGE_ACTION, REMOVE_ALL_ACTION, ROLE_CYCLE } from '../../../fixtures/items'
import { OWNED_ADD_PANEL } from '../../../fixtures/owned'
import { formState, hasFunction, isDeeplyFrozen, omit, panelsState, topFrameOf, translate } from './column-fixtures'

const LONG_LENGTH = 60
const ITEM_KINDS = 7
const LONG_TEXT = 'x'.repeat(LONG_LENGTH)
const MIN_LENGTH = 4
const NOW = 1000

const menuFrame: Frame = topFrameOf(panelsState())
const formFrame: Frame = topFrameOf(formState())

function formWith(change: (form: FormState) => FormState): Frame {
  const { form } = formFrame
  if (form === null) throw new Error('form expected')
  return { ...formFrame, form: change(form) }
}

function view(item: Item, frame: Frame = menuFrame): ReturnType<typeof rowView> {
  return rowView(item, frame, translate)
}

describe('rowView states', () => {
  it('renders a plain action with defaults', () => {
    expect(view(ADD_ACTION)).toMatchObject({ id: 'add', kind: RowKind.Plain, label: 'Add a player', focused: false, disabled: false, disabledFocused: false, pending: false, badge: null, error: null })
  })

  it('marks the focused row', () => {
    expect(view(ADD_ACTION, { ...menuFrame, focusItemId: 'add' }).focused).toBe(true)
  })

  it('marks a disabled row', () => {
    expect(view(PURGE_ACTION)).toMatchObject({ disabled: true, disabledFocused: false })
  })

  it('marks a disabled focused row for the outline style', () => {
    expect(view(PURGE_ACTION, { ...menuFrame, focusItemId: 'purge' })).toMatchObject({ disabled: true, focused: true, disabledFocused: true })
  })

  it('marks the pending item of the frame', () => {
    expect(view(ADD_ACTION, { ...menuFrame, pendingItemId: 'add' }).pending).toBe(true)
    expect(view(PURGE_ACTION, { ...menuFrame, pendingItemId: 'add' }).pending).toBe(false)
  })

  it('marks a busy action as pending', () => {
    expect(view({ ...ADD_ACTION, busy: true }).pending).toBe(true)
  })

  it('maps action variants', () => {
    expect(view(ADD_ACTION).variant).toBe(RowVariant.Primary)
    expect(view(REMOVE_ALL_ACTION).variant).toBe(RowVariant.Danger)
    expect(view({ ...ADD_ACTION, variant: ActionVariant.Secondary }).variant).toBe(RowVariant.Default)
    expect(view(omit(ADD_ACTION, 'variant')).variant).toBe(RowVariant.Default)
    expect(view(PLAYER_LINK).variant).toBe(RowVariant.Default)
  })

  it('exposes the icon or null', () => {
    expect(view(ADD_ACTION).icon).toBe('plus')
    expect(view(PLAYER_LINK).icon).toBeNull()
    expect(view(PLAYERS_SECTION).icon).toBeNull()
  })

  it.each(Object.values(BadgeTone))('renders a %s badge with its label', (tone) => {
    expect(view({ ...PLAYER_LINK, badge: { tone, label: 'Label' } }).badge).toEqual({ tone, label: 'Label' })
  })

  it('renders a link or info value and no badge when absent', () => {
    expect(view(PLAYER_LINK).value).toBe('Online')
    expect(view(omit(PLAYER_LINK, 'value')).value).toBeNull()
    expect(view(COUNT_INFO)).toMatchObject({ value: '1', badge: null })
    expect(view({ ...COUNT_INFO, badge: { tone: BadgeTone.Neutral, label: 'Soon' } }).badge?.label).toBe('Soon')
  })

  it('renders a section as a header', () => {
    expect(view(PLAYERS_SECTION)).toMatchObject({ kind: RowKind.Section, label: 'Players', disabled: false, value: null })
  })

  it('builds the element id used for the active descendant', () => {
    expect(view(ADD_ACTION).elementId).toBe(rowElementId('add'))
  })
})

describe('rowView values', () => {
  it('renders the cycle option label, from the item or the form', () => {
    expect(view(ROLE_CYCLE)).toMatchObject({ kind: RowKind.Cycle, value: 'Member' })
    expect(view(ROLE_CYCLE, formWith((form) => setFieldValue(form, 'role', 'staff'))).value).toBe('Staff')
  })

  it('renders an empty label for a cycle value without option', () => {
    expect(view({ ...ROLE_CYCLE, value: 'gone' }).value).toBe('')
  })

  it('renders toggles on and off, from the item or the form', () => {
    expect(view(ENABLED_TOGGLE)).toMatchObject({ kind: RowKind.Toggle, on: true })
    expect(view(NOTIFY_TOGGLE).on).toBe(false)
    expect(view(NOTIFY_TOGGLE, formWith((form) => setFieldValue(form, 'notify', true))).on).toBe(true)
    expect(view(ADD_ACTION).on).toBe(false)
  })

  it('renders the example text of an empty text field', () => {
    expect(view(IDENTIFIER_TEXT, formFrame)).toMatchObject({ kind: RowKind.Text, value: '', empty: true, placeholder: 'license:0123abcd' })
  })

  it('has no example text when the field declares none', () => {
    expect(view(omit(IDENTIFIER_TEXT, 'placeholder'), formFrame).placeholder).toBeNull()
  })

  it('renders a filled text field in full, leaving truncation to the CSS', () => {
    const frame = formWith((form) => setFieldValue(form, 'identifier', LONG_TEXT))
    expect(view(IDENTIFIER_TEXT, frame)).toMatchObject({ value: LONG_TEXT, empty: false })
  })

  it('renders the text of a menu field from the item', () => {
    expect(view({ ...IDENTIFIER_TEXT, value: 'abc' }).value).toBe('abc')
  })

  it('ignores a form value of the wrong type', () => {
    const frame = formWith((form) => ({ ...form, values: { ...form.values, role: true, notify: 'yes', identifier: false } }))
    expect(view(ROLE_CYCLE, frame).value).toBe('Member')
    expect(view(NOTIFY_TOGGLE, frame).on).toBe(false)
    expect(view(IDENTIFIER_TEXT, frame).value).toBe('')
  })
})

describe('rowView errors', () => {
  const submitted = (frame: Frame): Frame => {
    const form = frame.form
    const panel = OWNED_ADD_PANEL.panel
    if (form === null || panel.kind !== PanelKind.Form) throw new Error('form expected')
    return { ...frame, form: submitForm(form, panel, NOW).state }
  }

  it('renders the required message', () => {
    expect(view(IDENTIFIER_TEXT, submitted(formFrame)).error).toBe('Ce champ est obligatoire')
  })

  it('renders the format message', () => {
    const frame = formWith((form) => checkField(setFieldValue(form, 'identifier', 'nope'), IDENTIFIER_TEXT))
    expect(view(IDENTIFIER_TEXT, frame).error).toBe('Identifiant joueur attendu, par exemple license:abc123')
  })

  it('renders the minimum length with its parameter', () => {
    const item: Item = { ...IDENTIFIER_TEXT, rules: [{ kind: RuleKind.MinLength, min: MIN_LENGTH }] }
    const frame = formWith((form) => checkField(setFieldValue(form, 'identifier', 'ab'), item))
    expect(view(item, frame).error).toBe('Minimum 4 caractères')
  })

  it('falls back to a zero minimum when the rule is gone', () => {
    const item: Item = { ...IDENTIFIER_TEXT, rules: [{ kind: RuleKind.Format, format: TextFormat.Digits }] }
    const frame = formWith((form) => ({ ...form, errors: { identifier: { rule: RuleKind.MinLength, format: null, message: null } } }))
    expect(view(item, frame).error).toBe('Minimum 0 caractères')
    expect(view({ ...ROLE_CYCLE, id: 'identifier' }, frame).error).toBe('Minimum 0 caractères')
  })

  it('renders the generic format message when no format is known', () => {
    const frame = formWith((form) => ({ ...form, errors: { identifier: { rule: RuleKind.Format, format: null, message: null } } }))
    expect(view(IDENTIFIER_TEXT, frame).error).toBe('Format invalide')
  })

  it('prefers the message of the rule or of the resource', () => {
    const frame = formWith((form) => ({ ...form, errors: { identifier: { rule: null, format: null, message: 'Already taken' } } }))
    expect(view(IDENTIFIER_TEXT, frame).error).toBe('Already taken')
  })

  it('renders no error for another field or without form', () => {
    const frame = submitted(formFrame)
    expect(view(ROLE_CYCLE, frame).error).toBeNull()
    expect(view(IDENTIFIER_TEXT).error).toBeNull()
  })

  it('ignores an inherited error name', () => {
    expect(view({ ...ROLE_CYCLE, id: 'toString' }, formFrame).error).toBeNull()
  })

  it('ignores an error entry that is undefined', () => {
    const frame = formWith((form) => ({ ...form, errors: { identifier: undefined as never } }))
    expect(view(IDENTIFIER_TEXT, frame).error).toBeNull()
  })
})

describe('rowView output', () => {
  it.each([ADD_ACTION, PLAYER_LINK, COUNT_INFO, ROLE_CYCLE, ENABLED_TOGGLE, IDENTIFIER_TEXT, PLAYERS_SECTION, PURGE_ACTION])('is deeply frozen and carries no function (%#)', (item) => {
    const rendered = view(item, { ...formFrame, focusItemId: item.id })
    expect(isDeeplyFrozen(rendered)).toBe(true)
    expect(hasFunction(rendered)).toBe(false)
  })

  it('knows every item kind', () => {
    expect(Object.values(ItemKind)).toHaveLength(ITEM_KINDS)
  })
})
