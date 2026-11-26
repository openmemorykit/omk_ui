import type { ValueOf } from '@openmemorykit/core/shared'
import type { JsonObject } from '../shared/report/json-value'
import type { ReportKind } from '../shared/report/report-kind'
import type { UiMode } from './page-vocabulary'
import type { PageEvent } from './stack'

export const FromPage = {
  Ready: 'ready',
  Event: 'event',
  Ack: 'ack',
  ModeChanged: 'modeChanged',
  Paused: 'paused',
  EscapeReleased: 'escapeReleased',
  TextEntry: 'textEntry',
  Snapshot: 'snapshot',
  PageError: 'pageError',
  Trace: 'trace',
} as const
export type FromPage = ValueOf<typeof FromPage>

export const PAGE_ERROR_STACK_MAX_BYTES = 1024

interface ReadyMessage { readonly type: typeof FromPage.Ready }
interface EventMessage { readonly type: typeof FromPage.Event; readonly event: PageEvent }
interface AckMessage { readonly type: typeof FromPage.Ack; readonly lastIntentSeq: number }
interface ModeChangedMessage { readonly type: typeof FromPage.ModeChanged; readonly mode: UiMode; readonly escapeHeld?: true }
interface PausedMessage { readonly type: typeof FromPage.Paused; readonly paused: boolean }
interface EscapeReleasedMessage { readonly type: typeof FromPage.EscapeReleased }
interface TextEntryMessage { readonly type: typeof FromPage.TextEntry; readonly active: boolean }
interface SnapshotMessage { readonly type: typeof FromPage.Snapshot; readonly requestId: number; readonly snapshot: JsonObject }
interface PageErrorMessage { readonly type: typeof FromPage.PageError; readonly message: string; readonly stack: string }
interface TraceMessage { readonly type: typeof FromPage.Trace; readonly kind: ReportKind; readonly data: JsonObject }

export type FromPageMessage =
  | ReadyMessage
  | EventMessage
  | AckMessage
  | ModeChangedMessage
  | PausedMessage
  | EscapeReleasedMessage
  | TextEntryMessage
  | SnapshotMessage
  | PageErrorMessage
  | TraceMessage

export type FromPageMessageOf<Type extends FromPage> = Extract<FromPageMessage, { readonly type: Type }>
