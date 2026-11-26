import { ItemKind } from '@openmemorykit/ui/contract'
import type { Item } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import {
  firstFocusable,
  focusCounter,
  isFocusable,
  moveFocus,
  nearestFocusable,
  RENDER_OVERSCAN,
  renderWindow,
  VISIBLE_ROWS,
  visibleWindowStart,
} from '../../../src/page/domain/list-focus'
import { ADD_ACTION, COUNT_INFO, ENABLED_TOGGLE, PLAYER_LINK, PLAYERS_SECTION, PURGE_ACTION } from '../../fixtures/items'

const TWO = 2
const THREE = 3
const FOUR = 4
const FIVE = 5
const NINE = 9
const TEN = 10
const ELEVEN = 11
const TWELVE = 12
const FOURTEEN = 14
const TWENTY = 20
const TWENTY_NINE = 29
const THIRTY = 30
const NINETY_NINE = 99
const HUNDRED = 100
const MINUS_THREE = -3
const MINUS_FIVE = -5
const MINUS_FIFTY = -50
const QUARTER_TURN = 90

const INFO_WITH_DESCRIPTION: Item = { ...COUNT_INFO, id: 'described', description: 'Total' }

function link(id: string): Item {
  return { kind: ItemKind.Link, id, label: id }
}

function sections(count: number): readonly Item[] {
  return Array.from({ length: count }, (_, index) => ({ kind: ItemKind.Link, id: `row-${index}`, label: `Row ${index}` }))
}

describe('constants', () => {
  it('keeps the agreed values', () => {
    expect([VISIBLE_ROWS, RENDER_OVERSCAN]).toEqual([TEN, TEN])
  })
})

describe('isFocusable', () => {
  it('skips sections and infos without description', () => {
    expect(isFocusable(PLAYERS_SECTION)).toBe(false)
    expect(isFocusable(COUNT_INFO)).toBe(false)
  })

  it('keeps infos with a description and every other kind, disabled included', () => {
    expect(isFocusable(INFO_WITH_DESCRIPTION)).toBe(true)
    expect(isFocusable(PURGE_ACTION)).toBe(true)
    expect(isFocusable(ENABLED_TOGGLE)).toBe(true)
    expect(isFocusable(PLAYER_LINK)).toBe(true)
  })
})

describe('firstFocusable and moveFocus', () => {
  const items: readonly Item[] = [PLAYERS_SECTION, COUNT_INFO, ADD_ACTION, PLAYERS_SECTION, PURGE_ACTION, ENABLED_TOGGLE]

  it('finds the first focusable item', () => {
    expect(firstFocusable(items)).toBe(ADD_ACTION.id)
    expect(firstFocusable([])).toBeNull()
    expect(firstFocusable([PLAYERS_SECTION, COUNT_INFO])).toBeNull()
  })

  it('skips sections and wraps around in both directions', () => {
    expect(moveFocus(items, ADD_ACTION.id, 1)).toBe(PURGE_ACTION.id)
    expect(moveFocus(items, PURGE_ACTION.id, 1)).toBe(ENABLED_TOGGLE.id)
    expect(moveFocus(items, ENABLED_TOGGLE.id, 1)).toBe(ADD_ACTION.id)
    expect(moveFocus(items, ADD_ACTION.id, -1)).toBe(ENABLED_TOGGLE.id)
    expect(moveFocus(items, PURGE_ACTION.id, -1)).toBe(ADD_ACTION.id)
  })

  it('reaches disabled items', () => {
    expect(moveFocus(items, ADD_ACTION.id, 1)).toBe('purge')
  })

  it('starts at an end when nothing or an unknown item is focused', () => {
    expect(moveFocus(items, null, 1)).toBe(ADD_ACTION.id)
    expect(moveFocus(items, null, -1)).toBe(ENABLED_TOGGLE.id)
    expect(moveFocus(items, 'ghost', 1)).toBe(ADD_ACTION.id)
    expect(moveFocus(items, COUNT_INFO.id, 1)).toBe(ADD_ACTION.id)
  })

  it('returns null without focusable item and stays on a single one', () => {
    expect(moveFocus([], null, 1)).toBeNull()
    expect(moveFocus([PLAYERS_SECTION], null, -1)).toBeNull()
    expect(moveFocus([ADD_ACTION], ADD_ACTION.id, 1)).toBe(ADD_ACTION.id)
    expect(moveFocus([ADD_ACTION], ADD_ACTION.id, -1)).toBe(ADD_ACTION.id)
  })
})

describe('nearestFocusable', () => {
  const previous = sections(FIVE)

  it('keeps the focus by identifier after an update', () => {
    const reordered = [previous[FOUR], previous[TWO], previous[0]] as readonly Item[]
    expect(nearestFocusable(reordered, previous, 'row-2')).toBe('row-2')
  })

  it('takes the item that now sits at the removed position, else the closest before', () => {
    const [first, second, third, fourth, last] = previous as readonly [Item, Item, Item, Item, Item]
    expect(nearestFocusable([first, second, third, last], previous, fourth.id)).toBe(last.id)
    expect(nearestFocusable([first, second, third, fourth], previous, last.id)).toBe(fourth.id)
  })

  it('skips non focusable neighbors', () => {
    const next: readonly Item[] = [previous[0], PLAYERS_SECTION, COUNT_INFO, previous[FOUR]] as readonly Item[]
    expect(nearestFocusable(next, previous, 'row-2')).toBe('row-4')
  })

  it('moves focus away from an item that became a section', () => {
    const next: readonly Item[] = [previous[0], { kind: ItemKind.Section, id: 'row-1', label: 'Now a section' }, previous[TWO]] as readonly Item[]
    expect(nearestFocusable(next, previous, 'row-1')).toBe('row-2')
  })

  it('takes the first survivor after the vanished item even when earlier items vanished too', () => {
    const [alpha, zulu, bravo, charlie] = [link('a'), link('z'), link('b'), link('c')]
    expect(nearestFocusable([bravo, charlie], [alpha, zulu, bravo, charlie], 'z')).toBe('b')
    expect(nearestFocusable([PLAYERS_SECTION, alpha, bravo], [alpha, zulu, bravo], 'z')).toBe('b')
  })

  it('skips a survivor that stopped being focusable', () => {
    const [alpha, zulu, bravo, charlie] = [link('a'), link('z'), link('b'), link('c')]
    const bravoSection: Item = { kind: ItemKind.Section, id: 'b', label: 'Now a section' }
    expect(nearestFocusable([alpha, bravoSection, charlie], [alpha, zulu, bravo, charlie], 'z')).toBe('c')
  })

  it('takes the last survivor before when nothing survives after', () => {
    const [alpha, bravo, charlie, delta, echo] = [link('a'), link('b'), link('c'), link('d'), link('e')]
    expect(nearestFocusable([alpha, bravo], [alpha, bravo, charlie, delta, echo], 'e')).toBe('b')
    expect(nearestFocusable([alpha, charlie], [alpha, bravo, charlie, delta], 'd')).toBe('c')
  })

  it('does not fail on a list that starts with non focusable items or shares nothing', () => {
    const next: readonly Item[] = [PLAYERS_SECTION, COUNT_INFO, link('a')]
    expect(nearestFocusable(next, [link('x')], 'x')).toBe('a')
    expect(nearestFocusable([PLAYERS_SECTION, COUNT_INFO], [link('x')], 'x')).toBeNull()
  })

  it('falls back to the first focusable item without a usable previous focus', () => {
    expect(nearestFocusable(previous, previous, null)).toBe('row-0')
    expect(nearestFocusable(previous, previous, 'ghost')).toBe('row-0')
    expect(nearestFocusable([], previous, 'row-1')).toBeNull()
    expect(nearestFocusable([PLAYERS_SECTION], previous, 'row-1')).toBeNull()
  })
})

describe('visibleWindowStart', () => {
  it('keeps the window while the focus stays inside', () => {
    expect(visibleWindowStart(THIRTY, FIVE, 0)).toBe(0)
    expect(visibleWindowStart(THIRTY, NINE, 0)).toBe(0)
    expect(visibleWindowStart(THIRTY, FOURTEEN, FIVE)).toBe(FIVE)
  })

  it('follows the focus past either edge', () => {
    expect(visibleWindowStart(THIRTY, TEN, 0)).toBe(1)
    expect(visibleWindowStart(THIRTY, TWENTY, 0)).toBe(ELEVEN)
    expect(visibleWindowStart(THIRTY, THREE, ELEVEN)).toBe(THREE)
  })

  it('stays within the list', () => {
    expect(visibleWindowStart(THIRTY, TWENTY_NINE, 0)).toBe(TWENTY)
    expect(visibleWindowStart(FIVE, FOUR, THREE)).toBe(0)
    expect(visibleWindowStart(0, 0, FOUR)).toBe(0)
    expect(visibleWindowStart(THIRTY, TWO, NINETY_NINE)).toBe(TWO)
    expect(visibleWindowStart(THIRTY, -1, NINETY_NINE)).toBe(TWENTY)
  })

  it('does not throw on invalid input', () => {
    expect(visibleWindowStart(Number.NaN, Number.NaN, Number.NaN)).toBe(0)
    expect(visibleWindowStart(THIRTY, Number.POSITIVE_INFINITY, Number.NaN)).toBe(TWENTY)
    expect(visibleWindowStart(MINUS_FIVE, TWO, MINUS_THREE)).toBe(0)
  })
})

describe('renderWindow', () => {
  it('extends the visible rows by the overscan on both sides', () => {
    expect(renderWindow(HUNDRED, THIRTY)).toEqual({ start: TWENTY, end: 50 })
  })

  it('is bounded by the list', () => {
    expect(renderWindow(HUNDRED, 0)).toEqual({ start: 0, end: TWENTY })
    expect(renderWindow(HUNDRED, QUARTER_TURN)).toEqual({ start: 80, end: HUNDRED })
    expect(renderWindow(FIVE, 0)).toEqual({ start: 0, end: FIVE })
    expect(renderWindow(0, 0)).toEqual({ start: 0, end: 0 })
  })

  it('does not throw on invalid input', () => {
    expect(renderWindow(Number.NaN, Number.NaN)).toEqual({ start: 0, end: 0 })
    expect(renderWindow(HUNDRED, Number.POSITIVE_INFINITY)).toEqual({ start: 80, end: HUNDRED })
    expect(renderWindow(HUNDRED, MINUS_FIFTY)).toEqual({ start: 0, end: TWENTY })
  })
})

describe('focusCounter', () => {
  it('counts focusable items only, as in 3 of 12', () => {
    const items = [PLAYERS_SECTION, ...sections(TWELVE), COUNT_INFO]
    expect(focusCounter(items, 'row-2')).toEqual({ position: THREE, total: TWELVE })
    expect(focusCounter(items, 'row-11')).toEqual({ position: TWELVE, total: TWELVE })
  })

  it('gives position 0 without a focusable focus', () => {
    const items = [PLAYERS_SECTION, ...sections(THREE)]
    expect(focusCounter(items, null)).toEqual({ position: 0, total: THREE })
    expect(focusCounter(items, PLAYERS_SECTION.id)).toEqual({ position: 0, total: THREE })
    expect(focusCounter([], 'row-0')).toEqual({ position: 0, total: 0 })
  })
})
