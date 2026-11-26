import type { Item, Panel } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { FORM_SUBMIT_ROW_ID, rowLabel, steppedRowId } from '../../../src/page/domain/panel-rows'
import { ADD_ACTION, COUNT_INFO, ENABLED_TOGGLE, PLAYERS_SECTION, PURGE_ACTION } from '../../fixtures/items'
import { OWNED_LIST_PANEL } from '../../fixtures/owned'
import { ADD_PANEL } from '../../fixtures/panels'

const ITEMS: readonly Item[] = [PLAYERS_SECTION, COUNT_INFO, ADD_ACTION, PLAYERS_SECTION, PURGE_ACTION, ENABLED_TOGGLE]
const MENU: Panel = { ...OWNED_LIST_PANEL.panel, items: ITEMS }
const EMPTY_MENU: Panel = { ...MENU, items: [PLAYERS_SECTION] }
const FORM_FIELDS = ADD_PANEL.items.filter((item) => item.id !== PLAYERS_SECTION.id)

describe('steppedRowId on a menu', () => {
  it('skips sections and wraps around in both directions', () => {
    expect(steppedRowId(MENU, ADD_ACTION.id, 1)).toBe(PURGE_ACTION.id)
    expect(steppedRowId(MENU, PURGE_ACTION.id, 1)).toBe(ENABLED_TOGGLE.id)
    expect(steppedRowId(MENU, ENABLED_TOGGLE.id, 1)).toBe(ADD_ACTION.id)
    expect(steppedRowId(MENU, ADD_ACTION.id, -1)).toBe(ENABLED_TOGGLE.id)
  })

  it('starts at an end when nothing, an unknown or a section row is focused', () => {
    expect(steppedRowId(MENU, null, 1)).toBe(ADD_ACTION.id)
    expect(steppedRowId(MENU, null, -1)).toBe(ENABLED_TOGGLE.id)
    expect(steppedRowId(MENU, 'ghost', 1)).toBe(ADD_ACTION.id)
    expect(steppedRowId(MENU, PLAYERS_SECTION.id, -1)).toBe(ENABLED_TOGGLE.id)
  })

  it('returns null without a focusable row and stays on a single one', () => {
    expect(steppedRowId(EMPTY_MENU, null, 1)).toBeNull()
    expect(steppedRowId({ ...MENU, items: [ADD_ACTION] }, ADD_ACTION.id, 1)).toBe(ADD_ACTION.id)
    expect(steppedRowId({ ...MENU, items: [ADD_ACTION] }, ADD_ACTION.id, -1)).toBe(ADD_ACTION.id)
  })
})

describe('steppedRowId on a form', () => {
  it('ends the cycle with the submit row', () => {
    const last = FORM_FIELDS[FORM_FIELDS.length - 1]
    expect(steppedRowId(ADD_PANEL, last?.id ?? null, 1)).toBe(FORM_SUBMIT_ROW_ID)
    expect(steppedRowId(ADD_PANEL, FORM_SUBMIT_ROW_ID, 1)).toBe(FORM_FIELDS[0]?.id)
    expect(steppedRowId(ADD_PANEL, null, -1)).toBe(FORM_SUBMIT_ROW_ID)
  })

  it('stays on the submit row of a form without field', () => {
    expect(steppedRowId({ ...ADD_PANEL, items: [PLAYERS_SECTION] }, null, 1)).toBe(FORM_SUBMIT_ROW_ID)
  })
})

describe('rowLabel', () => {
  it('names the submit row, a focusable row, and nothing else', () => {
    expect(rowLabel(ADD_PANEL, FORM_SUBMIT_ROW_ID)).toBe(ADD_PANEL.submitLabel)
    expect(rowLabel(MENU, ADD_ACTION.id)).toBe(ADD_ACTION.label)
    expect(rowLabel(MENU, 'ghost')).toBe('')
    expect(rowLabel(MENU, PLAYERS_SECTION.id)).toBe('')
  })
})
