import { ContractErrorCode, OpenBlocker, ReplyKind } from '@openmemorykit/ui/contract'
import { Modality } from '../../src/protocol/intents'
import { PromptState, UiMode } from '../../src/protocol/page-vocabulary'
import { ReportKind } from '../../src/shared/report/report-kind'
import { AskOutcome } from '../../src/shared/report/report-payloads'
import { deepFrozen } from './frozen'

export const REPORT_AT = 1234

export const PAYLOAD_SAMPLES = deepFrozen({
  [ReportKind.ConfigApplied]: { gameBuild: 3258, locale: 'fr', config: { contrast: 'high' } },
  [ReportKind.ModeChanged]: { from: UiMode.Idle, to: UiMode.Radial },
  [ReportKind.PagePaused]: { paused: true },
  [ReportKind.PageReloaded]: { readyCount: 2 },
  [ReportKind.StackChanged]: { appliedCommandSeq: 3, panels: ['whitelist:list'] },
  [ReportKind.FocusApplied]: { focus: false, cursor: false, keepInput: false, reason: 'closed' },
  [ReportKind.ModalityChanged]: { modality: Modality.Gamepad },
  [ReportKind.BindingRead]: { radial: 'F1', interact: 'E', pushToTalk: 'N' },
  [ReportKind.CameraReplayed]: { context: 0, before: 1, expected: 4, actual: 4 },
  [ReportKind.ReleaseGuard]: { active: true, guard: 'pad' },
  [ReportKind.TextEntry]: { active: true },
  [ReportKind.OpenRefused]: { reason: OpenBlocker.PauseMenu, owner: 'garage' },
  [ReportKind.ContractRefused]: { owner: 'garage', errors: [{ path: 'items.0.id', code: ContractErrorCode.BadIdentifier }] },
  [ReportKind.UnknownField]: { owner: 'garage', path: 'items.0.colour' },
  [ReportKind.CallLimited]: { owner: 'garage', call: 'openPanel', code: ContractErrorCode.RateLimited },
  [ReportKind.ForgedCall]: { call: 'event' },
  [ReportKind.ReplyUndelivered]: { owner: 'garage', reply: ReplyKind.ItemSelected },
  [ReportKind.FormTimeout]: { owner: 'whitelist', panelId: 'add', submissionId: 1 },
  [ReportKind.PromptChanged]: { owner: 'garage', promptId: 'garage:enter', state: PromptState.Holding },
  [ReportKind.PanelPainted]: { panelId: 'list', durationMs: 4 },
  [ReportKind.PageError]: { message: 'boom', stack: 'at render' },
  [ReportKind.PageUnresponsive]: { silentMs: 5000, intentSeq: 12, lastAckSeq: 10 },
  [ReportKind.Snapshot]: { client: { mode: UiMode.Idle }, page: null, owners: [{ owner: 'garage', radialEntries: 1, panels: 2, prompts: 0, confirms: 0 }] },
  [ReportKind.ConfirmAsked]: { askId: 'question', outcome: AskOutcome.Confirmed },
  [ReportKind.DemoReply]: { owner: 'omk_ui_demo_whitelist', reply: ReplyKind.RadialSelected },
}) satisfies Readonly<Record<ReportKind, object>>

export interface SampleReport { readonly kind: ReportKind; readonly at: number; readonly data: object }

export function sampleReport(kind: ReportKind): SampleReport {
  return { kind, at: REPORT_AT, data: PAYLOAD_SAMPLES[kind] }
}
