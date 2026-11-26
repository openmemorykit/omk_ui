import { CloseReason, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { handleList } from '../../../../src/page/domain/panel-handlers'
import { transition } from '../../../../src/page/domain/intent-engine'
import { modeChanged } from '../../../../src/page/domain/mode-change'
import { sendToHost } from '../../../../src/page/domain/ui-effects'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import { Intent } from '../../../../src/protocol/intents'
import { OWNED_ADD_PANEL, OWNED_LIST_PANEL } from '../../../fixtures/owned'
import { initial, NOW, press, run, withPanels } from './engine-helpers'
import {
  BACK_HOLD_SCHEDULE,
  click,
  focusedAnnouncement,
  GAMEPAD,
  hover,
  REPEAT_SCHEDULE,
  replyEvent,
  stackEventOf,
  topFrame,
} from './handler-helpers'

const LIST_ID = OWNED_LIST_PANEL.panel.id
const OWNER = OWNED_LIST_PANEL.owner
const ROWS_AFTER_FIRST = 4
const DOWN_COUNTS = Array.from({ length: ROWS_AFTER_FIRST }, (_, index) => index + 1)
const LABELS: ReadonlyMap<string, string> = new Map(OWNED_LIST_PANEL.panel.items.map((item) => [item.id, item.label] as const))

function focusOf(commands: Parameters<typeof run>[1]): string | null {
  return topFrame(run(withPanels([OWNED_LIST_PANEL]), commands).state).focusItemId
}

function focused(itemId: string): ReturnType<typeof focusedAnnouncement> {
  return focusedAnnouncement(LIST_ID, itemId, LABELS.get(itemId) ?? '')
}

describe('list handler: moving the focus', () => {
  it('starts on the first focusable row', () => {
    expect(topFrame(withPanels([OWNED_LIST_PANEL])).focusItemId).toBe('enabled')
  })

  it('moves down, skips the section and the info row without description, and reaches the disabled row', () => {
    const downs = DOWN_COUNTS.map((count) => focusOf(Array.from({ length: count }, () => press(Intent.Down))))
    expect(downs).toEqual(['add', 'player-1', 'purge', 'remove-all'])
  })

  it('wraps at both ends', () => {
    expect(focusOf([press(Intent.Up)])).toBe('remove-all')
    expect(focusOf(Array.from({ length: 5 }, () => press(Intent.Down)))).toBe('enabled')
  })

  it('announces the focused row and schedules the repeat of the held direction', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), press(Intent.Down), NOW)
    expect(next.effects).toEqual([REPEAT_SCHEDULE, focused('add')])
  })

  it('keeps the visible window on the focused row', () => {
    const state = run(withPanels([OWNED_LIST_PANEL]), [press(Intent.Up)]).state
    expect(topFrame(state).visibleStart).toBe(0)
  })
})

describe('list handler: pointer', () => {
  it('focuses the hovered row with keyboard and mouse', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), hover('player-1'), NOW)
    expect(topFrame(next.state).focusItemId).toBe('player-1')
    expect(next.effects).toEqual([focused('player-1')])
  })

  it('ignores hovering with the gamepad', () => {
    const state = run(withPanels([OWNED_LIST_PANEL]), [GAMEPAD]).state
    const next = transition(state, hover('player-1'), NOW)
    expect(next).toEqual({ state, effects: [] })
  })

  it('ignores hovering the focused row, a section or an unknown row', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    ;['enabled', 'players', 'count', 'missing', '__proto__'].forEach((itemId) => {
      expect(transition(state, hover(itemId), NOW).state).toBe(state)
    })
  })

  it('confirms the clicked row after focusing it', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), click('add'), NOW)
    expect(topFrame(next.state).focusItemId).toBe('add')
    expect(next.effects).toEqual([replyEvent(OWNER, { kind: ReplyKind.ItemSelected, panelId: LIST_ID, itemId: 'add' })])
  })

  it('ignores a click on a section', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    expect(transition(state, click('players'), NOW)).toEqual({ state, effects: [] })
  })
})

describe('list handler: back', () => {
  it('pops the top frame with PanelClosed(Back)', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL]), press(Intent.Back), NOW)
    expect(next.state.stack.map((frame) => frame.panel?.panel.id)).toEqual([LIST_ID])
    expect(next.effects).toEqual([
      BACK_HOLD_SCHEDULE,
      stackEventOf({ appliedCommandSeq: 2, entries: [{ panelId: LIST_ID, owner: OWNER }] }, OWNER, { kind: ReplyKind.PanelClosed, panelId: OWNED_ADD_PANEL.panel.id, reason: CloseReason.Back }),
    ])
  })

  it('empties the stack at the root and goes Idle', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), press(Intent.Back), NOW)
    expect(next.state.stack).toEqual([])
    expect(next.state.mode).toBe(UiMode.Idle)
    expect(next.effects).toEqual([
      stackEventOf({ appliedCommandSeq: 1, entries: [] }, OWNER, { kind: ReplyKind.PanelClosed, panelId: LIST_ID, reason: CloseReason.Back }),
      sendToHost(modeChanged(UiMode.Idle, false)),
    ])
  })

  it('waits for the end of Escape when the root closes by Escape', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), press(Intent.Back, true), NOW)
    expect(next.state.escapeHeld).toBe(true)
    expect(next.effects[next.effects.length - 1]).toEqual(sendToHost(modeChanged(UiMode.Idle, true)))
  })
})

describe('list handler: other inputs', () => {
  it('ignores tabs, keyboard keys, text and aiming', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    const ignored = [Intent.TabNext, Intent.TabPrev, Intent.Erase, Intent.Space, Intent.Submit, Intent.Radial].map((intent) => press(intent))
    ignored.forEach((command) => {
      expect(handleList(state, command, NOW)).toEqual({ state, effects: [] })
    })
  })

  it('does nothing without a frame', () => {
    const state = initial()
    expect(handleList(state, press(Intent.Down), NOW)).toEqual({ state, effects: [] })
    expect(handleList(state, click('add'), NOW)).toEqual({ state, effects: [] })
  })
})
