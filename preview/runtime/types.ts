import type { ValueOf } from '@openmemorykit/core/shared'
import type { CallResult, ContractError, KitExport, Reply } from '@openmemorykit/ui/contract'
import type { Clock, Scheduler } from '../../src/page/application/ports'
import type { FromPageMessage } from '../../src/protocol/from-page'
import type { ToPage, ToPageMessage, ToPageMessageOf } from '../../src/protocol/to-page'
import type { PreviewSettings } from './preview-settings'

export const ScenarioId = {
  Radial: 'radial',
  RadialChildren: 'radial-children',
  WhitelistList: 'whitelist-list',
  Whitelist: 'whitelist',
  LongList: 'long-list',
  DisabledFocused: 'disabled-focused',
  FormErrors: 'form-errors',
  FormPending: 'form-pending',
  KeyboardLetters: 'keyboard-letters',
  KeyboardAccents: 'keyboard-accents',
  KeyboardSymbols: 'keyboard-symbols',
  ConfirmDanger: 'confirm-danger',
  Toasts: 'toasts',
  PromptHold: 'prompt-hold',
} as const
export type ScenarioId = ValueOf<typeof ScenarioId>

export const StepKind = { Call: 'call', Client: 'client', Wait: 'wait' } as const
export type StepKind = ValueOf<typeof StepKind>

export interface CallStep {
  readonly kind: typeof StepKind.Call
  readonly owner: string
  readonly name: KitExport
  readonly args: readonly unknown[]
}

type ClientMessageType = typeof ToPage.OpenRadial | typeof ToPage.Modality | typeof ToPage.GlyphSet | typeof ToPage.Stick | typeof ToPage.PromptProgress
export type ClientIntentMessage = Omit<ToPageMessageOf<typeof ToPage.Intent>, 'seq'>
export type ClientMessage = ClientIntentMessage | ToPageMessageOf<ClientMessageType>

export interface ClientStep { readonly kind: typeof StepKind.Client; readonly message: ClientMessage }
export interface WaitStep { readonly kind: typeof StepKind.Wait; readonly delayMs: number }

export type ScenarioStep = CallStep | ClientStep | WaitStep

export interface Scenario {
  readonly id: ScenarioId
  readonly steps: readonly ScenarioStep[]
}

export interface FakeResource {
  call(name: string, payload: unknown): unknown
  onReply(reply: Reply): void
}

export interface FakeKit { call(name: string, args: unknown): CallResult }
export type FakeResourceFactory = (kit: FakeKit) => FakeResource

export interface ScenarioEntry {
  readonly scenario: Scenario
  readonly resources: ReadonlyMap<string, FakeResourceFactory>
}
export type ScenarioCatalog = ReadonlyMap<string, ScenarioEntry>

export const LogKind = {
  ToPage: 'toPage',
  FromPage: 'fromPage',
  Call: 'call',
  Reply: 'reply',
  ReplyRefused: 'replyRefused',
  ReplyUndelivered: 'replyUndelivered',
  NotificationDropped: 'notificationDropped',
  ScenarioRefused: 'scenarioRefused',
} as const
export type LogKind = ValueOf<typeof LogKind>

export type LogEvent =
  | { readonly kind: typeof LogKind.ToPage; readonly message: ToPageMessage }
  | { readonly kind: typeof LogKind.FromPage; readonly message: FromPageMessage }
  | { readonly kind: typeof LogKind.Call; readonly owner: string; readonly name: string; readonly result: CallResult }
  | { readonly kind: typeof LogKind.Reply; readonly owner: string; readonly reply: Reply }
  | { readonly kind: typeof LogKind.ReplyRefused; readonly owner: string; readonly errors: readonly ContractError[] }
  | { readonly kind: typeof LogKind.ReplyUndelivered; readonly owner: string; readonly reply: Reply }
  | { readonly kind: typeof LogKind.NotificationDropped; readonly owner: string }
  | { readonly kind: typeof LogKind.ScenarioRefused; readonly scenarioId: string; readonly errors: readonly ContractError[] }

export interface LogEntry {
  readonly at: number
  readonly event: LogEvent
}

export interface PreviewRuntimeOptions {
  readonly clock: Clock
  readonly scheduler: Scheduler
  readonly catalog?: ScenarioCatalog
}

export interface PreviewRuntime {
  start(id: ScenarioId, settings: PreviewSettings): void
  deliver(message: FromPageMessage): void
  listen(listener: (message: ToPageMessage) => void): () => void
  log(): readonly LogEntry[]
  onLog(listener: () => void): () => void
  settled(): boolean
}
