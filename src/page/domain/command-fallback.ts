import { CloseReason, ReplyKind, STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import type { OwnedConfirm, OwnedPanel } from '../../protocol/owned'
import type { OwnedReply } from '../../protocol/stack'
import { ToPage } from '../../protocol/to-page'
import { isAddressablePanel } from './navigation'
import { isNewerCommand, refusedConfirmReplies } from './stack-commands'
import { stackEvent, unchanged, withEffects, type Transition } from './ui-effects'
import type { UiState } from './ui-state'

export const BOOT_PANEL_SCAN_MAX = STACK_MAX_DEPTH + STACK_MAX_DEPTH

type UnknownRecord = Readonly<Record<string, unknown>>

const NO_REPLIES: readonly OwnedReply[] = Object.freeze([])

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null
const isList = <Element>(value: readonly Element[]): value is readonly Element[] => Array.isArray(value)
const isCommandSeq = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

export function bootPanels(panels: readonly OwnedPanel[]): readonly OwnedPanel[] {
  return isList(panels) ? panels.slice(0, BOOT_PANEL_SCAN_MAX) : []
}

function discardedReplies(panel: unknown): readonly OwnedReply[] {
  if (!isAddressablePanel(panel)) return NO_REPLIES
  return [{ owner: panel.owner, reply: { kind: ReplyKind.PanelClosed, panelId: panel.panel.id, reason: CloseReason.Discarded } }]
}

function bootReplies(state: UiState, command: UnknownRecord): readonly OwnedReply[] {
  const discarded = bootPanels(command.panels as readonly OwnedPanel[]).flatMap(discardedReplies)
  const confirm = command.confirm === null ? NO_REPLIES : refusedConfirmReplies(state, command.confirm as OwnedConfirm)
  return discarded.concat(confirm)
}

function owedReplies(state: UiState, command: UnknownRecord): readonly OwnedReply[] | null {
  switch (command.type) {
    case ToPage.OpenPanel:
    case ToPage.PushPanel:
      return discardedReplies(command.panel)
    case ToPage.ShowConfirm:
      return refusedConfirmReplies(state, command.confirm as OwnedConfirm)
    case ToPage.ClosePanel:
    case ToPage.DropOwner:
      return NO_REPLIES
    case ToPage.Boot:
      return bootReplies(state, command)
    default:
      return null
  }
}

function appliedSeq(state: UiState, command: UnknownRecord): number | null {
  const { commandSeq } = command
  if (!isCommandSeq(commandSeq)) return null
  if (command.type === ToPage.Boot) return commandSeq
  return isNewerCommand(state, commandSeq) ? commandSeq : null
}

export function fallbackTransition(state: UiState, command: unknown): Transition {
  try {
    if (!isRecord(command)) return unchanged(state)
    const replies = owedReplies(state, command)
    const commandSeq = appliedSeq(state, command)
    if (replies === null || commandSeq === null) return unchanged(state)
    const applied = { ...state, appliedCommandSeq: commandSeq }
    return withEffects(applied, [stackEvent(applied, replies)])
  } catch {
    return unchanged(state)
  }
}
