import { ItemKind, type Item, type Reply } from '@openmemorykit/ui/contract'
import { BACK_HOLD_MS } from '../../../../src/page/domain/hold-detector'
import { PageCommandType, TimerKind, type UiCommand } from '../../../../src/page/domain/page-commands'
import { REPEAT_DELAY_MS } from '../../../../src/page/domain/repeat-policy'
import { Announcement, schedule, sendToHost, UiEffectType, type UiEffect } from '../../../../src/page/domain/ui-effects'
import type { Frame, Layer, UiState } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { Modality } from '../../../../src/protocol/intents'
import type { OwnedPanel } from '../../../../src/protocol/owned'
import type { StackSnapshot } from '../../../../src/protocol/stack'
import { ToPage } from '../../../../src/protocol/to-page'
import { IDENTIFIER_TEXT } from '../../../fixtures/items'
import { FixtureOwner, OWNED_ADD_PANEL } from '../../../fixtures/owned'
import { menuPanel } from '../navigation-helpers'

export const REPEAT_SCHEDULE: UiEffect = schedule(TimerKind.Repeat, REPEAT_DELAY_MS)
export const BACK_HOLD_SCHEDULE: UiEffect = schedule(TimerKind.BackHold, BACK_HOLD_MS)
export const TEXT_ENTRY_ON: UiEffect = sendToHost({ type: FromPage.TextEntry, active: true })
export const TEXT_ENTRY_OFF: UiEffect = sendToHost({ type: FromPage.TextEntry, active: false })
export const VALID_IDENTIFIER = 'license:0123abcd'
export const GAMEPAD: UiCommand = { type: ToPage.Modality, modality: Modality.Gamepad }

export function replyEvent(owner: string, reply: Reply): UiEffect {
  return sendToHost({ type: FromPage.Event, event: { stack: null, replies: [{ owner, reply }] } })
}

export function stackEventOf(stack: StackSnapshot, owner: string, reply: Reply): UiEffect {
  return sendToHost({ type: FromPage.Event, event: { stack, replies: [{ owner, reply }] } })
}

export function focusedAnnouncement(panelId: string, itemId: string, label: string): UiEffect {
  return { type: UiEffectType.Announce, announcement: Announcement.ItemFocused, params: { panelId, itemId, label } }
}

export function formErrorsAnnouncement(panelId: string, count: number): UiEffect {
  return { type: UiEffectType.Announce, announcement: Announcement.FormErrors, params: { panelId, count } }
}

export function hover(itemId: string): UiCommand {
  return { type: PageCommandType.HoverItem, itemId }
}

export function click(itemId: string): UiCommand {
  return { type: PageCommandType.ClickItem, itemId }
}

export function typeText(value: string): UiCommand {
  return { type: PageCommandType.TypeText, value }
}

export function topFrame(state: UiState): Frame {
  const top = state.stack[state.stack.length - 1]
  if (top === undefined) throw new Error('frame expected')
  return top
}

export function topLayer(state: UiState): Layer | undefined {
  const { layers } = topFrame(state)
  return layers[layers.length - 1]
}

export function itemOf(state: UiState, itemId: string): Item | undefined {
  return topFrame(state).panel?.panel.items.find((item) => item.id === itemId)
}

export function formWith(items: readonly Item[], localId = 'add'): OwnedPanel {
  return { owner: FixtureOwner.Whitelist, panel: { ...OWNED_ADD_PANEL.panel, id: `whitelist/${localId}`, items } }
}

export const PLAIN_TEXT: Extract<Item, { readonly kind: typeof ItemKind.Text }> = { ...IDENTIFIER_TEXT, id: 'note', label: 'Note', rules: [] }

export const NOTE_MENU: OwnedPanel = menuPanel('notes', FixtureOwner.Whitelist, [PLAIN_TEXT])

export function changeOf(state: UiState, itemId: string): unknown {
  const item = itemOf(state, itemId)
  return item !== undefined && 'value' in item ? item.value : undefined
}
