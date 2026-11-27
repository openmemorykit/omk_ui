import * as v from 'valibot'
import type { ValueOf } from '@openmemorykit/core/shared'
import {
  CONFIRMS_PER_OWNER,
  ContractErrorCode,
  ERROR_PATH_MAX_LENGTH,
  MAX_REPORTED_ERRORS,
  OpenBlocker,
  PROMPTS_PER_OWNER,
  RADIAL_ENTRIES_PER_OWNER,
  ReplyKind,
  STACK_MAX_DEPTH,
} from '@openmemorykit/ui/contract'
import { PAGE_ERROR_STACK_MAX_BYTES } from '../../protocol/from-page'
import { Modality } from '../../protocol/intents'
import { NAMESPACED_ID_MAX_LENGTH, OWNER_MAX_LENGTH } from '../../protocol/namespaced-id'
import { PromptState, UiMode } from '../../protocol/page-vocabulary'
import { JsonObjectSchema } from './json-value'
import { ownStrictObject } from './own-strict-object'
import { ReportKind } from './report-kind'

export const REPORT_TEXT_MAX_LENGTH = 256
export const SNAPSHOT_MAX_OWNERS = 32

export const AskOutcome = { Confirmed: 'confirmed', Declined: 'declined', Refused: 'refused' } as const
export type AskOutcome = ValueOf<typeof AskOutcome>

const MIN_LENGTH = 1

const boundedText = (maxLength: number): v.SchemaWithPipe<readonly [v.StringSchema<undefined>, v.MinLengthAction<string, number, undefined>, v.MaxLengthAction<string, number, undefined>]> =>
  v.pipe(v.string(), v.minLength(MIN_LENGTH), v.maxLength(maxLength))
const countUpTo = (maximum: number): v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.SafeIntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, number, undefined>]> =>
  v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(maximum))
const oneOf = <Vocabulary extends Readonly<Record<string, string>>>(vocabulary: Vocabulary): v.PicklistSchema<ValueOf<Vocabulary>[], undefined> =>
  v.picklist(Object.values(vocabulary) as ValueOf<Vocabulary>[])

const Owner = boundedText(OWNER_MAX_LENGTH)
const Target = boundedText(NAMESPACED_ID_MAX_LENGTH)
const Text = boundedText(REPORT_TEXT_MAX_LENGTH)
const Path = v.pipe(v.string(), v.maxLength(ERROR_PATH_MAX_LENGTH))
const Count = countUpTo(Number.MAX_SAFE_INTEGER)
const Duration = v.pipe(v.number(), v.finite(), v.minValue(0))
const Flag = v.boolean()

const OwnerUsageSchema = ownStrictObject({
  owner: Owner,
  radialEntries: countUpTo(RADIAL_ENTRIES_PER_OWNER),
  panels: countUpTo(STACK_MAX_DEPTH),
  prompts: countUpTo(PROMPTS_PER_OWNER),
  confirms: countUpTo(CONFIRMS_PER_OWNER),
})
export type OwnerUsage = v.InferOutput<typeof OwnerUsageSchema>

const ReportedErrorSchema = ownStrictObject({ path: Path, code: oneOf(ContractErrorCode) })

export const ReportPayloadSchema = {
  [ReportKind.ConfigApplied]: ownStrictObject({ gameBuild: Count, locale: Text, config: JsonObjectSchema }),
  [ReportKind.ModeChanged]: ownStrictObject({ from: oneOf(UiMode), to: oneOf(UiMode) }),
  [ReportKind.PagePaused]: ownStrictObject({ paused: Flag }),
  [ReportKind.PageReloaded]: ownStrictObject({ readyCount: Count }),
  [ReportKind.StackChanged]: ownStrictObject({ appliedCommandSeq: Count, panels: v.pipe(v.array(Target), v.maxLength(STACK_MAX_DEPTH)) }),
  [ReportKind.FocusApplied]: ownStrictObject({ focus: Flag, cursor: Flag, keepInput: Flag, reason: v.exactOptional(Text) }),
  [ReportKind.ModalityChanged]: ownStrictObject({ modality: oneOf(Modality) }),
  [ReportKind.BindingRead]: ownStrictObject({ radial: Text, interact: Text, pushToTalk: Text }),
  [ReportKind.CameraReplayed]: ownStrictObject({ context: Count, before: Count, expected: Count, actual: Count }),
  [ReportKind.ReleaseGuard]: ownStrictObject({ active: Flag, guard: Text }),
  [ReportKind.TextEntry]: ownStrictObject({ active: Flag }),
  [ReportKind.OpenRefused]: ownStrictObject({ reason: oneOf(OpenBlocker), owner: v.exactOptional(Owner) }),
  [ReportKind.ContractRefused]: ownStrictObject({ owner: Owner, errors: v.pipe(v.array(ReportedErrorSchema), v.maxLength(MAX_REPORTED_ERRORS)) }),
  [ReportKind.UnknownField]: ownStrictObject({ owner: Owner, path: Path }),
  [ReportKind.CallLimited]: ownStrictObject({ owner: Owner, call: Text, code: oneOf(ContractErrorCode) }),
  [ReportKind.ForgedCall]: ownStrictObject({ call: Text }),
  [ReportKind.ReplyUndelivered]: ownStrictObject({ owner: Owner, reply: oneOf(ReplyKind) }),
  [ReportKind.FormTimeout]: ownStrictObject({ owner: Owner, panelId: Target, submissionId: Count }),
  [ReportKind.PromptChanged]: ownStrictObject({ owner: Owner, promptId: Target, state: oneOf(PromptState) }),
  [ReportKind.PanelPainted]: ownStrictObject({ panelId: Target, durationMs: Duration }),
  [ReportKind.PageError]: ownStrictObject({ message: v.pipe(v.string(), v.maxLength(REPORT_TEXT_MAX_LENGTH)), stack: v.pipe(v.string(), v.maxBytes(PAGE_ERROR_STACK_MAX_BYTES)) }),
  [ReportKind.PageUnresponsive]: ownStrictObject({ silentMs: Duration, intentSeq: Count, lastAckSeq: Count }),
  [ReportKind.Snapshot]: ownStrictObject({
    client: JsonObjectSchema,
    page: v.nullable(JsonObjectSchema),
    owners: v.pipe(v.array(OwnerUsageSchema), v.maxLength(SNAPSHOT_MAX_OWNERS)),
  }),
  [ReportKind.ConfirmAsked]: ownStrictObject({ askId: Text, outcome: oneOf(AskOutcome), reason: v.exactOptional(v.picklist([...Object.values(OpenBlocker), ...Object.values(ContractErrorCode)])) }),
} as const satisfies Readonly<Record<ReportKind, v.GenericSchema>>
