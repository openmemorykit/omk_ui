import { ReplyKind } from '@openmemorykit/ui/contract'
import { splitNamespacedId } from '../../protocol/namespaced-id'
import type { OwnedConfirm, OwnedPanel } from '../../protocol/owned'
import type { OwnedReply } from '../../protocol/stack'
import type { ToPage } from '../../protocol/to-page'
import { isNewerCommand, isRecord, NO_REPLIES } from './guards'
import { closePanelFrame, dropOwnerFrames, isConfirmShown, openPanelFrame, pushPanelFrame, showConfirmLayer, type StackChange } from './navigation'
import type { UiCommandOf } from './page-commands'
import { withRadialEntries } from './radial-navigation'
import { Announcement, stackEvent, unchanged, UiEffectType, withEffects, type CommandHandler, type Transition, type UiEffect } from './ui-effects'
import type { UiState } from './ui-state'

export function isNewerStackCommand(state: UiState, commandSeq: number): boolean {
  return isNewerCommand(state.appliedCommandSeq, commandSeq)
}

export function refusedConfirmReplies(state: UiState, owned: OwnedConfirm): readonly OwnedReply[] {
  if (!isRecord(owned) || !isRecord(owned.confirm)) return NO_REPLIES
  const { owner } = owned
  const confirmId: unknown = owned.confirm.id
  if (typeof owner !== 'string' || typeof confirmId !== 'string' || splitNamespacedId(confirmId)?.owner !== owner) return NO_REPLIES
  if (isConfirmShown(state.stack, confirmId)) return NO_REPLIES
  return [{ owner, reply: { kind: ReplyKind.ConfirmAnswered, confirmId, confirmed: false } }]
}

function stackTransition(change: StackChange, extra: readonly UiEffect[] = []): Transition {
  return withEffects(change.state, [stackEvent(change.state, change.replies), ...extra])
}

function openedEffects(before: UiState, change: StackChange, owned: OwnedPanel): readonly UiEffect[] {
  if (change.state.stack === before.stack) return []
  const { id: panelId, title } = owned.panel
  return [
    { type: UiEffectType.MeasurePaint, panelId },
    { type: UiEffectType.Announce, announcement: Announcement.PanelOpened, params: { panelId, title } },
  ]
}

export const handleOpenPanel: CommandHandler<UiCommandOf<typeof ToPage.OpenPanel>> = (state, message) => {
  if (!isNewerStackCommand(state, message.commandSeq)) return unchanged(state)
  const change = openPanelFrame(state, message.panel, message.commandSeq)
  return stackTransition(change, openedEffects(state, change, message.panel))
}

export const handlePushPanel: CommandHandler<UiCommandOf<typeof ToPage.PushPanel>> = (state, message) => {
  if (!isNewerStackCommand(state, message.commandSeq)) return unchanged(state)
  const change = pushPanelFrame(state, message.panel, message.parentId, message.commandSeq)
  return stackTransition(change, openedEffects(state, change, message.panel))
}

export const handleClosePanel: CommandHandler<UiCommandOf<typeof ToPage.ClosePanel>> = (state, message) => {
  if (!isNewerStackCommand(state, message.commandSeq)) return unchanged(state)
  return stackTransition(closePanelFrame(state, message.panelId, message.commandSeq))
}

function withoutOwnerSurfaces(state: UiState, owner: string): UiState {
  const prompt = state.prompt?.prompt.owner === owner ? null : state.prompt
  const entries = state.radial.entries.filter((owned) => owned.owner !== owner)
  const radial = entries.length === state.radial.entries.length ? state.radial : withRadialEntries(state.radial, entries)
  return prompt === state.prompt && radial === state.radial ? state : { ...state, prompt, radial }
}

export const handleDropOwner: CommandHandler<UiCommandOf<typeof ToPage.DropOwner>> = (state, message) => {
  if (!isNewerStackCommand(state, message.commandSeq)) return unchanged(state)
  const dropped = withoutOwnerSurfaces(dropOwnerFrames(state, message.owner, message.commandSeq), message.owner)
  return stackTransition({ state: dropped, replies: NO_REPLIES })
}

export function confirmChange(state: UiState, confirm: OwnedConfirm, commandSeq: number): StackChange {
  const shown = showConfirmLayer(state, confirm, commandSeq)
  return { state: shown, replies: shown.stack === state.stack ? refusedConfirmReplies(state, confirm) : NO_REPLIES }
}

export const handleShowConfirm: CommandHandler<UiCommandOf<typeof ToPage.ShowConfirm>> = (state, message) => {
  if (!isNewerStackCommand(state, message.commandSeq)) return unchanged(state)
  return stackTransition(confirmChange(state, message.confirm, message.commandSeq))
}
