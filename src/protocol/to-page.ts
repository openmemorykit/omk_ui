import type { ValueOf } from '@openmemorykit/core/shared'
import type { FormResult } from '@openmemorykit/ui/contract'
import type { ThemeConfig } from '../shared/config/config-schema'
import type { IntentEvent, Modality, StickEvent } from './intents'
import type { OwnedConfirm, OwnedNotification, OwnedPanel, OwnedPrompt, OwnedRadialEntry } from './owned'
import type { GlyphSet, PromptState } from './page-vocabulary'

export const ToPage = {
  Boot: 'boot',
  Intent: 'intent',
  Stick: 'stick',
  Modality: 'modality',
  OpenRadial: 'openRadial',
  RadialEntries: 'radialEntries',
  OpenPanel: 'openPanel',
  PushPanel: 'pushPanel',
  UpdatePanel: 'updatePanel',
  ClosePanel: 'closePanel',
  ResolveForm: 'resolveForm',
  ShowConfirm: 'showConfirm',
  Notify: 'notify',
  ShowPrompt: 'showPrompt',
  PromptProgress: 'promptProgress',
  HidePrompt: 'hidePrompt',
  DropOwner: 'dropOwner',
  GlyphSet: 'glyphSet',
  SnapshotRequest: 'snapshotRequest',
} as const
export type ToPage = ValueOf<typeof ToPage>

export interface BindingLabels {
  readonly radial: string
  readonly interact: string
  readonly pushToTalk: string
}

export interface LocaleBundle {
  readonly language: string
  readonly messages: Readonly<Record<string, string>>
}

interface BootMessage {
  readonly type: typeof ToPage.Boot
  readonly settings: ThemeConfig
  readonly locale: LocaleBundle
  readonly glyphSet: GlyphSet
  readonly bindings: BindingLabels
  readonly radialEntries: readonly OwnedRadialEntry[]
  readonly panels: readonly OwnedPanel[]
  readonly confirm: OwnedConfirm | null
  readonly prompt: OwnedPrompt | null
  readonly commandSeq: number
}

interface IntentMessage extends IntentEvent {
  readonly type: typeof ToPage.Intent
  readonly seq: number
}

interface StickMessage extends StickEvent {
  readonly type: typeof ToPage.Stick
}

interface ModalityMessage { readonly type: typeof ToPage.Modality; readonly modality: Modality }
interface OpenRadialMessage { readonly type: typeof ToPage.OpenRadial }
interface RadialEntriesMessage { readonly type: typeof ToPage.RadialEntries; readonly entries: readonly OwnedRadialEntry[] }
interface OpenPanelMessage { readonly type: typeof ToPage.OpenPanel; readonly commandSeq: number; readonly panel: OwnedPanel }
interface PushPanelMessage { readonly type: typeof ToPage.PushPanel; readonly commandSeq: number; readonly panel: OwnedPanel; readonly parentId: string }
interface UpdatePanelMessage { readonly type: typeof ToPage.UpdatePanel; readonly panel: OwnedPanel }
interface ClosePanelMessage { readonly type: typeof ToPage.ClosePanel; readonly commandSeq: number; readonly panelId: string }

interface ResolveFormMessage {
  readonly type: typeof ToPage.ResolveForm
  readonly panelId: string
  readonly submissionId: number
  readonly result: FormResult
}

interface ShowConfirmMessage { readonly type: typeof ToPage.ShowConfirm; readonly commandSeq: number; readonly confirm: OwnedConfirm }
interface NotifyMessage { readonly type: typeof ToPage.Notify; readonly notification: OwnedNotification }
interface ShowPromptMessage { readonly type: typeof ToPage.ShowPrompt; readonly prompt: OwnedPrompt }

interface PromptProgressMessage {
  readonly type: typeof ToPage.PromptProgress
  readonly promptId: string
  readonly state: PromptState
  readonly holdMs: number
}

interface HidePromptMessage { readonly type: typeof ToPage.HidePrompt; readonly promptId: string }
interface DropOwnerMessage { readonly type: typeof ToPage.DropOwner; readonly commandSeq: number; readonly owner: string }
interface GlyphSetMessage { readonly type: typeof ToPage.GlyphSet; readonly glyphSet: GlyphSet }
interface SnapshotRequestMessage { readonly type: typeof ToPage.SnapshotRequest; readonly requestId: number }

export type ToPageMessage =
  | BootMessage
  | IntentMessage
  | StickMessage
  | ModalityMessage
  | OpenRadialMessage
  | RadialEntriesMessage
  | OpenPanelMessage
  | PushPanelMessage
  | UpdatePanelMessage
  | ClosePanelMessage
  | ResolveFormMessage
  | ShowConfirmMessage
  | NotifyMessage
  | ShowPromptMessage
  | PromptProgressMessage
  | HidePromptMessage
  | DropOwnerMessage
  | GlyphSetMessage
  | SnapshotRequestMessage

export type ToPageMessageOf<Type extends ToPage> = Extract<ToPageMessage, { readonly type: Type }>
