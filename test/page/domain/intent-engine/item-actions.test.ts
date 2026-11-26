import { ReplyKind, type Item } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { transition } from '../../../../src/page/domain/intent-engine'
import { LINK_PENDING_MS, TimerKind } from '../../../../src/page/domain/page-commands'
import { REPEAT_DELAY_MS, REPEAT_INTERVAL_MS, REPEAT_MAX_PER_CALL } from '../../../../src/page/domain/repeat-policy'
import { schedule, sendToHost, UiEffectType } from '../../../../src/page/domain/ui-effects'
import { ConfirmChoice, ConfirmOrigin, LayerKind } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { Intent } from '../../../../src/protocol/intents'
import { ENABLED_TOGGLE, IDENTIFIER_FIELD_MAX_LENGTH, REMOVE_ALL_ACTION, ROLE_CYCLE } from '../../../fixtures/items'
import { FixtureOwner, OWNED_LIST_PANEL } from '../../../fixtures/owned'
import { menuPanel } from '../navigation-helpers'
import { NOW, press, pushPanel, run, timerFired, withPanels } from './engine-helpers'
import { click, hover, itemOf, NOTE_MENU, PLAIN_TEXT, REPEAT_SCHEDULE, replyEvent, TEXT_ENTRY_ON, topFrame, topLayer } from './handler-helpers'

const OWNER = FixtureOwner.Whitelist
const LIST_ID = OWNED_LIST_PANEL.panel.id
const THREE_OPTIONS: Item = { ...ROLE_CYCLE, id: 'tier', options: [{ id: 'low', label: 'Low' }, { id: 'mid', label: 'Mid' }, { id: 'high', label: 'High' }], value: 'low' }
const SETTINGS = menuPanel('settings', OWNER, [THREE_OPTIONS, ENABLED_TOGGLE])
const SETTINGS_ID = SETTINGS.panel.id
const PUSH_SEQ = 2
const LATE_REPEAT_MS = 500
const OPTION_COUNT = 3
const CONFIRM_COUNTS = Array.from({ length: OPTION_COUNT }, (_, index) => index + 1)

function changed(panelId: string, itemId: string, value: string | boolean): ReturnType<typeof replyEvent> {
  return replyEvent(OWNER, { kind: ReplyKind.ValueChanged, panelId, itemId, value })
}

function valueOf(state: Parameters<typeof itemOf>[0], itemId: string): unknown {
  const item = itemOf(state, itemId)
  return item !== undefined && 'value' in item ? item.value : undefined
}

describe('Action', () => {
  it('sends ItemSelected in an Event without stack', () => {
    const next = transition(run(withPanels([OWNED_LIST_PANEL]), [hover('add')]).state, press(Intent.Confirm), NOW)
    expect(next.effects).toEqual([replyEvent(OWNER, { kind: ReplyKind.ItemSelected, panelId: LIST_ID, itemId: 'add' })])
  })

  it('does nothing on a disabled row, which stays reachable', () => {
    const state = run(withPanels([OWNED_LIST_PANEL]), [hover('purge')]).state
    expect(topFrame(state).focusItemId).toBe('purge')
    expect(transition(state, press(Intent.Confirm), NOW)).toEqual({ state, effects: [] })
  })

  it('opens a confirmation layer first when the action asks for it, without any reply', () => {
    const next = transition(run(withPanels([OWNED_LIST_PANEL]), [hover('remove-all')]).state, press(Intent.Confirm), NOW)
    expect(next.effects).toEqual([])
    expect(topLayer(next.state)).toEqual({
      kind: LayerKind.Confirm,
      origin: ConfirmOrigin.Item,
      content: REMOVE_ALL_ACTION.confirm,
      confirmId: null,
      itemId: 'remove-all',
      choice: ConfirmChoice.Cancel,
    })
  })

  it('ignores left and right', () => {
    const state = run(withPanels([OWNED_LIST_PANEL]), [hover('add')]).state
    expect(transition(state, press(Intent.Right), NOW).effects).toEqual([REPEAT_SCHEDULE])
  })
})

describe('Link', () => {
  const onLink = (): ReturnType<typeof withPanels> => run(withPanels([OWNED_LIST_PANEL]), [hover('player-1')]).state

  it('sends ItemSelected, marks the row pending and schedules the pending delay', () => {
    const next = transition(onLink(), press(Intent.Confirm), NOW)
    expect(topFrame(next.state).pendingItemId).toBe('player-1')
    expect(next.effects).toEqual([
      replyEvent(OWNER, { kind: ReplyKind.ItemSelected, panelId: LIST_ID, itemId: 'player-1' }),
      schedule(TimerKind.LinkPending, LINK_PENDING_MS),
    ])
  })

  it('clears the pending row when the delay fires', () => {
    const pending = run(onLink(), [press(Intent.Confirm)]).state
    const next = transition(pending, timerFired(TimerKind.LinkPending), NOW)
    expect(topFrame(next.state).pendingItemId).toBeNull()
    expect(next.effects).toEqual([])
  })

  it('clears the pending row when the child panel is pushed', () => {
    const pending = run(onLink(), [press(Intent.Confirm)]).state
    const pushed = run(pending, [pushPanel(menuPanel('player'), LIST_ID, PUSH_SEQ)]).state
    expect(pushed.stack[0]?.pendingItemId).toBeNull()
  })

  it('ignores the pending delay when nothing is pending', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    expect(transition(state, timerFired(TimerKind.LinkPending), NOW)).toEqual({ state, effects: [] })
  })
})

describe('Cycle', () => {
  it('changes the value right away on right and left, with wrapping, and sends ValueChanged', () => {
    const state = withPanels([SETTINGS])
    const right = transition(state, press(Intent.Right), NOW)
    expect(valueOf(right.state, 'tier')).toBe('mid')
    expect(right.effects).toEqual([REPEAT_SCHEDULE, changed(SETTINGS_ID, 'tier', 'mid')])
    const left = transition(state, press(Intent.Left), NOW)
    expect(valueOf(left.state, 'tier')).toBe('high')
    expect(left.effects).toEqual([REPEAT_SCHEDULE, changed(SETTINGS_ID, 'tier', 'high')])
  })

  it('sends the values of a late repeat in a single Event, in order', () => {
    const held = run(withPanels([SETTINGS]), [press(Intent.Left)]).state
    const next = transition(held, timerFired(TimerKind.Repeat), NOW + LATE_REPEAT_MS)
    const values = ['mid', 'low', 'high'].map((value) => ({ owner: OWNER, reply: { kind: ReplyKind.ValueChanged, panelId: SETTINGS_ID, itemId: 'tier', value } }))
    expect(next.effects).toEqual([
      sendToHost({ type: FromPage.Event, event: { stack: null, replies: values } }),
      schedule(TimerKind.Repeat, REPEAT_DELAY_MS + REPEAT_MAX_PER_CALL * REPEAT_INTERVAL_MS - LATE_REPEAT_MS),
    ])
    expect(valueOf(next.state, 'tier')).toBe('high')
  })

  it('moves one step forward on confirm and wraps after the last option', () => {
    const states = CONFIRM_COUNTS.map((count) => run(withPanels([SETTINGS]), Array.from({ length: count }, () => press(Intent.Confirm))).state)
    expect(states.map((state) => valueOf(state, 'tier'))).toEqual(['mid', 'high', 'low'])
  })

  it('does nothing on a disabled cycle', () => {
    const disabled = menuPanel('locked', OWNER, [{ ...THREE_OPTIONS, disabled: { reason: 'Locked' } }])
    const state = withPanels([disabled])
    expect(transition(state, press(Intent.Confirm), NOW)).toEqual({ state, effects: [] })
  })

  it('says nothing when a single option cannot change', () => {
    const single = menuPanel('single', OWNER, [{ ...ROLE_CYCLE, options: [{ id: 'member', label: 'Member' }] }])
    const state = withPanels([single])
    expect(transition(state, press(Intent.Confirm), NOW)).toEqual({ state, effects: [] })
  })
})

describe('Toggle', () => {
  const onToggle = (): ReturnType<typeof withPanels> => run(withPanels([SETTINGS]), [hover('enabled')]).state

  it('flips the value on confirm and sends ValueChanged', () => {
    const next = transition(onToggle(), press(Intent.Confirm), NOW)
    expect(valueOf(next.state, 'enabled')).toBe(false)
    expect(next.effects).toEqual([changed(SETTINGS_ID, 'enabled', false)])
  })

  it('sets false on left and true on right, and says nothing when the value stays', () => {
    const off = transition(onToggle(), press(Intent.Left), NOW)
    expect(off.effects).toEqual([REPEAT_SCHEDULE, changed(SETTINGS_ID, 'enabled', false)])
    expect(transition(onToggle(), press(Intent.Right), NOW).effects).toEqual([REPEAT_SCHEDULE])
    expect(transition(off.state, press(Intent.Right), NOW).effects).toEqual([REPEAT_SCHEDULE, changed(SETTINGS_ID, 'enabled', true)])
  })

  it('flips the clicked toggle', () => {
    const next = transition(withPanels([SETTINGS]), click('enabled'), NOW)
    expect(next.effects).toEqual([changed(SETTINGS_ID, 'enabled', false)])
  })
})

describe('Text', () => {
  it('opens the keyboard layer, focuses the text input and starts the text entry', () => {
    const next = transition(withPanels([NOTE_MENU]), press(Intent.Confirm), NOW)
    expect(next.effects).toEqual([{ type: UiEffectType.FocusTextInput, itemId: 'note' }, TEXT_ENTRY_ON])
    const layer = topLayer(next.state)
    expect(layer?.kind === LayerKind.Keyboard ? [layer.itemId, layer.initialValue, layer.keyboard.value, layer.keyboard.maxLength] : null).toEqual(['note', '', '', IDENTIFIER_FIELD_MAX_LENGTH])
  })

  it('opens the keyboard with the current value', () => {
    const filled = menuPanel('filled', OWNER, [{ ...PLAIN_TEXT, value: 'hello' }])
    const layer = topLayer(run(withPanels([filled]), [press(Intent.Confirm)]).state)
    expect(layer?.kind === LayerKind.Keyboard ? [layer.initialValue, layer.keyboard.value] : null).toEqual(['hello', 'hello'])
  })
})
