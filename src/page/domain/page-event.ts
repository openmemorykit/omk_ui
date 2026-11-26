import { ReplyKind, type Reply } from '@openmemorykit/ui/contract'
import { FromPage, type FromPageMessage } from '../../protocol/from-page'
import type { OwnedReply, StackEntry, StackSnapshot } from '../../protocol/stack'
import type { Frame, UiState } from './ui-state'

interface ReplyFilter { readonly kept: readonly OwnedReply[]; readonly settledKeys: ReadonlySet<string> }

const EMPTY_FILTER: ReplyFilter = { kept: [], settledKeys: new Set<string>() }
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

function keepUntilSettled(filter: ReplyFilter, owned: OwnedReply): ReplyFilter {
  const key = instanceKey(owned.reply)
  if (key === null) return { ...filter, kept: filter.kept.concat(owned) }
  if (filter.settledKeys.has(key)) return filter
  const settledKeys = isSettling(owned.reply) ? new Set([...filter.settledKeys, key]) : filter.settledKeys
  return { kept: filter.kept.concat(owned), settledKeys }
}

export function pageEvent(stackChanged: StackSnapshot | null, replies: readonly OwnedReply[]): FromPageMessage {
  return { type: FromPage.Event, event: { stack: stackChanged, replies: replies.reduce(keepUntilSettled, EMPTY_FILTER).kept } }
}
