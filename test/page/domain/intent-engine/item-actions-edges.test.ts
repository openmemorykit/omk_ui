import { ItemKind, ReplyKind, type Item } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { transition } from '../../../../src/page/domain/intent-engine'
import { activateItem } from '../../../../src/page/domain/item-actions'
import { ConfirmChoice, type Frame, type UiState } from '../../../../src/page/domain/ui-state'
import { Intent } from '../../../../src/protocol/intents'
import { ENABLED_TOGGLE, PLAYER_LINK, REMOVE_ALL_ACTION, ROLE_CYCLE } from '../../../fixtures/items'
import { FixtureOwner } from '../../../fixtures/owned'
import { menuPanel } from '../navigation-helpers'
import { initial, NOW, press, run, withPanels } from './engine-helpers'
import { changeOf, hover, NOTE_MENU, replyEvent, topFrame, topLayer } from './handler-helpers'

const OWNER = FixtureOwner.Whitelist
const GHOST_VALUE = 'ghost'
const OPTIONS: Item = { ...ROLE_CYCLE, id: 'tier', options: [{ id: 'low', label: 'Low' }, { id: 'mid', label: 'Mid' }, { id: 'high', label: 'High' }], value: 'low' }
const DESCRIBED_INFO: Item = { kind: ItemKind.Info, id: 'rules', label: 'Rules', value: '3', description: 'Read the rules' }
const NO_FRAME_PANEL: Frame = { panel: null, focusItemId: null, layers: [], form: null, pendingItemId: null, visibleStart: 0 }

function onItem(items: readonly Item[], itemId: string): UiState {
  return run(withPanels([menuPanel('edges', OWNER, items)]), [hover(itemId)]).state
}

function unchangedBy(state: UiState, intent: Intent): void {
  expect(activateItem(state, intent, NOW)).toEqual({ state, effects: [] })
}

describe('item actions: confirmation choice', () => {
  it('starts on Confirm when the action does not warn about danger', () => {
    const safe: Item = { ...REMOVE_ALL_ACTION, confirm: { ...REMOVE_ALL_ACTION.confirm!, danger: false } }
    const next = transition(onItem([safe], 'remove-all'), press(Intent.Confirm), NOW)
    expect(next.effects).toEqual([])
    const layer = topLayer(next.state)
    expect(layer !== undefined && 'choice' in layer ? layer.choice : null).toBe(ConfirmChoice.Confirm)
  })
})

describe('item actions: intents a row does not use', () => {
  it('ignores directions on a cycle and a toggle', () => {
    unchangedBy(onItem([OPTIONS], 'tier'), Intent.Up)
    unchangedBy(onItem([ENABLED_TOGGLE], 'enabled'), Intent.Down)
  })

  it('ignores left and right on an action, a link and a text row', () => {
    unchangedBy(onItem([REMOVE_ALL_ACTION], 'remove-all'), Intent.Left)
    unchangedBy(onItem([PLAYER_LINK], 'player-1'), Intent.Right)
    unchangedBy(withPanels([NOTE_MENU]), Intent.Left)
  })

  it('ignores a described info row', () => {
    unchangedBy(onItem([DESCRIBED_INFO], 'rules'), Intent.Confirm)
  })
})

describe('item actions: cycle values', () => {
  const stray: Item = { ...OPTIONS, value: GHOST_VALUE }

  it('goes to the first option on right when the value is not an option', () => {
    const next = transition(onItem([stray], 'tier'), press(Intent.Right), NOW)
    expect(changeOf(next.state, 'tier')).toBe('low')
    expect(next.effects).toContainEqual(replyEvent(OWNER, { kind: ReplyKind.ValueChanged, panelId: 'whitelist/edges', itemId: 'tier', value: 'low' }))
  })

  it('goes to the last option on left when the value is not an option', () => {
    const next = transition(onItem([stray], 'tier'), press(Intent.Left), NOW)
    expect(changeOf(next.state, 'tier')).toBe('high')
  })

  it('does nothing when there is no option to go to', () => {
    unchangedBy(onItem([{ ...OPTIONS, options: [] }], 'tier'), Intent.Right)
  })
})

describe('item actions: no row to act on', () => {
  it('does nothing on an empty page', () => {
    unchangedBy(initial(), Intent.Confirm)
  })

  it('does nothing on a frame without panel', () => {
    const state: UiState = { ...initial(), stack: [NO_FRAME_PANEL] }
    expect(topFrame(state).panel).toBeNull()
    unchangedBy(state, Intent.Confirm)
  })
})
