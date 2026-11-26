import { ReplyKind, type Item, type Reply } from '@openmemorykit/ui/contract'
import { openPanelFrame, pushPanelFrame } from '../../../src/page/domain/navigation'
import { createInitialState, type UiState } from '../../../src/page/domain/ui-state'
import type { OwnedConfirm, OwnedPanel } from '../../../src/protocol/owned'
import type { OwnedReply } from '../../../src/protocol/stack'
import { FixtureOwner, OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM } from '../../fixtures/owned'

export type ReplyOfKind<Kind extends ReplyKind> = Extract<Reply, { readonly kind: Kind }>

export function menuPanel(localId: string, owner: string = FixtureOwner.Whitelist, items: readonly Item[] = OWNED_LIST_PANEL.panel.items): OwnedPanel {
  return { owner, panel: { ...OWNED_LIST_PANEL.panel, id: `${owner}/${localId}`, items } }
}

export function confirmFor(owner: string, localId: string = 'remove-player-1'): OwnedConfirm {
  return { owner, confirm: { ...OWNED_REMOVE_CONFIRM.confirm, id: `${owner}/${localId}` } }
}

export function panelIdAt(state: UiState, index: number): string | null {
  return state.stack[index]?.panel?.panel.id ?? null
}

export function stackIds(state: UiState): readonly (string | null)[] {
  return state.stack.map((frame) => frame.panel?.panel.id ?? null)
}

export function stackOfDepth(depth: number): UiState {
  const first = menuPanel('level-0')
  const opened = openPanelFrame(createInitialState(), first, 1).state
  return Array.from({ length: depth - 1 }, (_, index) => index + 1).reduce(
    (state, level) => pushPanelFrame(state, menuPanel(`level-${String(level)}`), `whitelist/level-${String(level - 1)}`, level + 1).state,
    opened,
  )
}

export function closedReplies(replies: readonly OwnedReply[]): readonly ReplyOfKind<typeof ReplyKind.PanelClosed>[] {
  return replies.flatMap((owned) => (owned.reply.kind === ReplyKind.PanelClosed ? [owned.reply] : []))
}

export function replyKinds(replies: readonly OwnedReply[]): readonly ReplyKind[] {
  return replies.map((owned) => owned.reply.kind)
}
