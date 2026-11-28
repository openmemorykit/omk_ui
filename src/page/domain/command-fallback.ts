import { CloseReason } from '@openmemorykit/ui/contract'
import type { OwnedConfirm, OwnedPanel } from '../../protocol/owned'
import { isCommandSeq, type OwnedReply } from '../../protocol/stack'
import { ToPage } from '../../protocol/to-page'
import { bootPanels } from './boot'
import { isNewerCommand, isRecord, NO_REPLIES } from './guards'
import { closeAllFrames, closePanelFrame, discardedReply, dropOwnerFrames, isAddressablePanel, replacedStack, type StackChange } from './navigation'
import { refusedConfirmReplies } from './stack-commands'
import { stackEvent, unchanged, withEffects, type Transition } from './ui-effects'
import type { UiState } from './ui-state'

type UnknownRecord = Readonly<Record<string, unknown>>

function discardedReplies(panel: unknown): readonly OwnedReply[] {
  return isAddressablePanel(panel) ? discardedReply(panel) : NO_REPLIES
}

function bootReplies(emptied: UiState, command: UnknownRecord): readonly OwnedReply[] {
  const discarded = bootPanels(command.panels as readonly OwnedPanel[]).flatMap(discardedReplies)
  const confirm = command.confirm === null ? NO_REPLIES : refusedConfirmReplies(emptied, command.confirm as OwnedConfirm)
  return discarded.concat(confirm)
}

function unchangedStack(base: UiState, replies: readonly OwnedReply[]): StackChange {
  return { state: base, replies }
}

function replacedByOpen(base: UiState, panel: unknown): StackChange {
  const replaced = replacedStack(base)
  return { state: replaced.state, replies: replaced.replies.concat(discardedReplies(panel)) }
}

function fallbackChange(base: UiState, command: UnknownRecord): StackChange | null {
  switch (command.type) {
    case ToPage.OpenPanel:
      return replacedByOpen(base, command.panel)
    case ToPage.PushPanel:
      return unchangedStack(base, discardedReplies(command.panel))
    case ToPage.ClosePanel:
      return closePanelFrame(base, command.panelId as string, base.appliedCommandSeq)
    case ToPage.DropOwner:
      return unchangedStack(dropOwnerFrames(base, command.owner as string, base.appliedCommandSeq), NO_REPLIES)
    case ToPage.CloseAll:
      return closeAllFrames(base, CloseReason.CloseAll)
    case ToPage.ShowConfirm:
      return unchangedStack(base, refusedConfirmReplies(base, command.confirm as OwnedConfirm))
    case ToPage.Boot:
      return unchangedStack(base, bootReplies(base, command))
    default:
      return null
  }
}

function fallbackBase(state: UiState, command: UnknownRecord): UiState | null {
  const { commandSeq } = command
  if (!isCommandSeq(commandSeq)) return null
  if (command.type === ToPage.Boot) return { ...state, stack: [], appliedCommandSeq: commandSeq }
  return isNewerCommand(state.appliedCommandSeq, commandSeq) ? { ...state, appliedCommandSeq: commandSeq } : null
}

export function fallbackTransition(state: UiState, command: unknown): Transition {
  try {
    if (!isRecord(command)) return unchanged(state)
    const base = fallbackBase(state, command)
    const change = base === null ? null : fallbackChange(base, command)
    if (change === null) return unchanged(state)
    return withEffects(change.state, [stackEvent(change.state, change.replies)])
  } catch {
    return unchanged(state)
  }
}
