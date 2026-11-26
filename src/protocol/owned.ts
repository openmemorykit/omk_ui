import { ReplyKind } from '@openmemorykit/ui/contract'
import type { ConfirmRequest, Notification, Panel, Prompt, RadialEntry, Reply } from '@openmemorykit/ui/contract'
import { namespaceId, splitNamespacedId } from './namespaced-id'
import type { OwnedReply, StackEntry } from './stack'

export interface OwnedPanel { readonly owner: string; readonly panel: Panel }
export interface OwnedConfirm { readonly owner: string; readonly confirm: ConfirmRequest }
export interface OwnedPrompt { readonly owner: string; readonly prompt: Prompt }
export interface OwnedRadialEntry { readonly owner: string; readonly entry: RadialEntry }
export interface OwnedNotification { readonly owner: string; readonly notification: Notification }
export interface StackEntryOwner { readonly owner: string; readonly localPanelId: string }
export interface LocalReply { readonly owner: string; readonly reply: Reply }

export function toPagePanel(owner: string, panel: Panel): OwnedPanel {
  return { owner, panel: { ...panel, id: namespaceId(owner, panel.id) } }
}

export function toPageConfirm(owner: string, confirm: ConfirmRequest): OwnedConfirm {
  return { owner, confirm: { ...confirm, id: namespaceId(owner, confirm.id) } }
}

export function toPagePrompt(owner: string, prompt: Prompt): OwnedPrompt {
  return { owner, prompt: { ...prompt, id: namespaceId(owner, prompt.id) } }
}

export function toPageRadialEntry(owner: string, entry: RadialEntry): OwnedRadialEntry {
  return { owner, entry: { ...entry, id: namespaceId(owner, entry.id) } }
}

export function toPageNotification(owner: string, notification: Notification): OwnedNotification {
  const { key } = notification
  return { owner, notification: key === undefined ? notification : { ...notification, key: namespaceId(owner, key) } }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null

function localIdOf(namespacedId: string, owner: string): string | null {
  const parts = splitNamespacedId(namespacedId)
  return parts !== null && parts.owner === owner ? parts.localId : null
}

export function fromPageStackEntry(entry: StackEntry): StackEntryOwner | null {
  if (!isRecord(entry)) return null
  const localPanelId = localIdOf(entry.panelId, entry.owner)
  return localPanelId === null ? null : { owner: entry.owner, localPanelId }
}

function localizeReply(reply: Reply, owner: string): Reply | null {
  switch (reply.kind) {
    case ReplyKind.ItemSelected:
    case ReplyKind.ValueChanged:
    case ReplyKind.FormSubmitted:
    case ReplyKind.PanelClosed: {
      const panelId = localIdOf(reply.panelId, owner)
      return panelId === null ? null : { ...reply, panelId }
    }
    case ReplyKind.ConfirmAnswered: {
      const confirmId = localIdOf(reply.confirmId, owner)
      return confirmId === null ? null : { ...reply, confirmId }
    }
    case ReplyKind.RadialSelected: {
      const entryId = localIdOf(reply.entryId, owner)
      return entryId === null ? null : { ...reply, entryId }
    }
    case ReplyKind.PromptCompleted: {
      const promptId = localIdOf(reply.promptId, owner)
      return promptId === null ? null : { ...reply, promptId }
    }
    default:
      return null
  }
}

export function fromPageReply(ownedReply: OwnedReply): LocalReply | null {
  if (!isRecord(ownedReply) || !isRecord(ownedReply.reply)) return null
  const reply = localizeReply(ownedReply.reply, ownedReply.owner)
  return reply === null ? null : { owner: ownedReply.owner, reply }
}
