import { CloseReason, ReplyKind } from '@openmemorykit/ui/contract'
import type { OwnedConfirm, OwnedPanel } from '../../protocol/owned'
import { isCommandSeq, type OwnedReply } from '../../protocol/stack'
import { ToPage } from '../../protocol/to-page'
import { bootPanels } from './boot'
import { isNewerCommand, isRecord, NO_REPLIES } from './guards'
import { closeAllFrames, isAddressablePanel, type StackChange } from './navigation'
import { refusedConfirmReplies } from './stack-commands'
import { stackEvent, unchanged, withEffects, type Transition } from './ui-effects'
import type { UiState } from './ui-state'

type UnknownRecord = Readonly<Record<string, unknown>>

function discardedReplies(panel: unknown): readonly OwnedReply[] {
  if (!isAddressablePanel(panel)) return NO_REPLIES
  return [{ owner: panel.owner, reply: { kind: ReplyKind.PanelClosed, panelId: panel.panel.id, reason: CloseReason.Discarded } }]
}

function bootReplies(emptied: UiState, command: UnknownRecord): readonly OwnedReply[] {
  const discarded = bootPanels(command.panels as readonly OwnedPanel[]).flatMap(discardedReplies)
  const confirm = command.confirm === null ? NO_REPLIES : refusedConfirmReplies(emptied, command.confirm as OwnedConfirm)
  return discarded.concat(confirm)
}

function owedReplies(base: UiState, command: UnknownRecord): readonly OwnedReply[] | null {
  switch (command.type) {
    case ToPage.OpenPanel:
    case ToPage.PushPanel:
      return discardedReplies(command.panel)
    case ToPage.ShowConfirm:
      return refusedConfirmReplies(base, command.confirm as OwnedConfirm)
    case ToPage.ClosePanel:
    case ToPage.DropOwner:
      return NO_REPLIES
    case ToPage.Boot:
      return bootReplies(base, command)
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

function fallbackChange(base: UiState, command: UnknownRecord): StackChange | null {
  if (command.type === ToPage.CloseAll) return closeAllFrames(base, CloseReason.CloseAll)
  const replies = owedReplies(base, command)
  return replies === null ? null : { state: base, replies }
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
