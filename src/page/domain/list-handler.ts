import { ItemKind } from '@openmemorykit/ui/contract'
import { Intent, IntentPhase, Modality } from '../../protocol/intents'
import type { OwnedPanel } from '../../protocol/owned'
import { expireForms } from './form-handler'
import { topFrameOf, withTopFrame } from './frame-updates'
import { activateItem } from './item-actions'
import { popTopFrame } from './navigation'
import { PageCommandType, TimerKind, type LocalIntentCommand, type UiCommand } from './page-commands'
import { focusableItem, isFocusableRow, rowLabel, rowWindowStart, steppedRowId, type RowStep } from './panel-rows'
import { Announcement, stackEvent, unchanged, UiEffectType, withEffects, type CommandHandler, type Transition, type UiEffect } from './ui-effects'
import type { Frame, UiState } from './ui-state'

interface ListContext { readonly frame: Frame; readonly owned: OwnedPanel }

const PREVIOUS = -1
const NEXT = 1

function listContext(state: UiState): ListContext | null {
  const frame = topFrameOf(state)
  return frame === undefined || frame.panel === null ? null : { frame, owned: frame.panel }
}

function focusedOn(state: UiState, context: ListContext, rowId: string): UiState {
  const { frame, owned } = context
  return withTopFrame(state, { ...frame, focusItemId: rowId, visibleStart: rowWindowStart(owned.panel, rowId, frame.visibleStart) })
}

function focusAnnouncement(owned: OwnedPanel, rowId: string): UiEffect {
  return { type: UiEffectType.Announce, announcement: Announcement.ItemFocused, params: { panelId: owned.panel.id, itemId: rowId, label: rowLabel(owned.panel, rowId) } }
}

function announcedFocus(state: UiState, context: ListContext, rowId: string | null): Transition {
  if (rowId === null || rowId === context.frame.focusItemId) return unchanged(state)
  return withEffects(focusedOn(state, context, rowId), [focusAnnouncement(context.owned, rowId)])
}

function moved(state: UiState, context: ListContext, step: RowStep): Transition {
  return announcedFocus(state, context, steppedRowId(context.owned.panel, context.frame.focusItemId, step))
}

function hovered(state: UiState, context: ListContext, rowId: unknown): Transition {
  if (state.modality !== Modality.KeyboardMouse || !isFocusableRow(context.owned.panel, rowId)) return unchanged(state)
  return announcedFocus(state, context, rowId)
}

function clicked(state: UiState, context: ListContext, rowId: unknown, now: number): Transition {
  if (!isFocusableRow(context.owned.panel, rowId)) return unchanged(state)
  return activateItem(focusedOn(state, context, rowId), Intent.Confirm, now)
}

function stepped(state: UiState, context: ListContext, itemId: string, step: RowStep, now: number): Transition {
  const item = focusableItem(context.owned.panel, itemId)
  if (item?.kind !== ItemKind.Cycle) return unchanged(state)
  return activateItem(focusedOn(state, context, itemId), step === PREVIOUS ? Intent.Left : Intent.Right, now)
}

function back(state: UiState, fromEscape: boolean): Transition {
  const change = popTopFrame(state)
  const popped = change.state.stack.length === 0 ? { ...change.state, escapeHeld: fromEscape } : change.state
  return withEffects(popped, [stackEvent(popped, change.replies)])
}

function listIntent(state: UiState, context: ListContext, command: LocalIntentCommand, now: number): Transition {
  switch (command.intent) {
    case Intent.Up:
      return moved(state, context, PREVIOUS)
    case Intent.Down:
      return moved(state, context, NEXT)
    case Intent.Left:
    case Intent.Right:
    case Intent.Confirm:
      return activateItem(state, command.intent, now)
    case Intent.Back:
      return back(state, command.fromEscape)
    default:
      return unchanged(state)
  }
}

function withoutPendingLinks(state: UiState): Transition {
  if (!state.stack.some((frame) => frame.pendingItemId !== null)) return unchanged(state)
  return unchanged({ ...state, stack: state.stack.map((frame) => (frame.pendingItemId === null ? frame : { ...frame, pendingItemId: null })) })
}

function timerFired(state: UiState, timer: TimerKind, now: number): Transition {
  switch (timer) {
    case TimerKind.LinkPending:
      return withoutPendingLinks(state)
    case TimerKind.FormTimeout:
      return expireForms(state, now)
    default:
      return unchanged(state)
  }
}

function inputHandled(state: UiState, command: UiCommand, now: number): Transition {
  const context = listContext(state)
  if (context === null) return unchanged(state)
  switch (command.type) {
    case PageCommandType.LocalIntent:
      return command.phase === IntentPhase.Press ? listIntent(state, context, command, now) : unchanged(state)
    case PageCommandType.HoverItem:
      return hovered(state, context, command.itemId)
    case PageCommandType.ClickItem:
      return clicked(state, context, command.itemId, now)
    case PageCommandType.StepItem:
      return stepped(state, context, command.itemId, command.step, now)
    default:
      return unchanged(state)
  }
}

export const handleList: CommandHandler<UiCommand> = (state, command, now) =>
  command.type === PageCommandType.TimerFired ? timerFired(state, command.timer, now) : inputHandled(state, command, now)
