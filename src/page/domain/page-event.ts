import { CloseReason, ReplyKind, type Reply } from '@openmemorykit/ui/contract'
import { FromPage, type FromPageMessage } from '../../protocol/from-page'
import type { OwnedReply, StackEntry, StackSnapshot } from '../../protocol/stack'
import type { Frame, UiState } from './ui-state'

const PANEL_KEY_PREFIX = 'panel:'
const CONFIRM_KEY_PREFIX = 'confirm:'

function entryOf(frame: Frame): readonly StackEntry[] {
  return frame.panel === null ? [] : [{ panelId: frame.panel.panel.id, owner: frame.panel.owner }]
}

export function stackSnapshot(state: UiState): StackSnapshot {
  return { appliedCommandSeq: state.appliedCommandSeq, entries: state.stack.flatMap(entryOf) }
}

function instanceKey(reply: Reply): string | null {
  switch (reply.kind) {
    case ReplyKind.ItemSelected:
    case ReplyKind.ValueChanged:
    case ReplyKind.FormSubmitted:
    case ReplyKind.PanelClosed:
      return `${PANEL_KEY_PREFIX}${reply.panelId}`
    case ReplyKind.ConfirmAnswered:
      return `${CONFIRM_KEY_PREFIX}${reply.confirmId}`
    default:
      return null
  }
}

const isSettling = (reply: Reply): boolean => reply.kind === ReplyKind.PanelClosed || reply.kind === ReplyKind.ConfirmAnswered
const isDiscardedOpening = (reply: Reply): boolean => reply.kind === ReplyKind.PanelClosed && reply.reason === CloseReason.Discarded

function keptReplies(replies: readonly OwnedReply[]): readonly OwnedReply[] {
  const settledKeys = new Set<string>()
  const kept: OwnedReply[] = []
  for (const owned of replies) {
    const key = instanceKey(owned.reply)
    if (key !== null && settledKeys.has(key) && !isDiscardedOpening(owned.reply)) continue
    if (key !== null && isSettling(owned.reply)) settledKeys.add(key)
    kept.push(owned)
  }
  return Object.freeze(kept)
}

export function pageEvent(stackChanged: StackSnapshot | null, replies: readonly OwnedReply[]): FromPageMessage {
  return { type: FromPage.Event, event: { stack: stackChanged, replies: keptReplies(replies) } }
}
