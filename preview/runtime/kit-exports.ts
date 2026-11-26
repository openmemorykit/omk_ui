import {
  ConfirmRequestSchema,
  ContractErrorCode,
  FormResultSchema,
  IdentifierSchema,
  KitExport,
  NotificationSchema,
  PanelSchema,
  PromptSchema,
  RadialEntrySchema,
  type ContractError,
} from '@openmemorykit/ui/contract'
import { normalizePayload, validateContract, ValidationStatus } from '@openmemorykit/ui/validation'
import type { GenericSchema, InferOutput } from 'valibot'
import {
  addRadialEntry,
  checkFormOwner,
  closePanel,
  hidePrompt,
  openPanel,
  pushPanel,
  radialOrder,
  removeRadialEntry,
  showConfirm,
  showPrompt,
  updatePanel,
  visiblePrompt,
  type RegistryOutcome,
  type RegistryState,
} from '../../src/client/domain/owner-registry'
import { namespaceId } from '../../src/protocol/namespaced-id'
import { toPageConfirm, toPageNotification, toPagePanel, toPagePrompt } from '../../src/protocol/owned'
import { ToPage, type ToPageMessage } from '../../src/protocol/to-page'

export type Applied =
  | { readonly ok: true; readonly registry: RegistryState; readonly messages: readonly ToPageMessage[] }
  | { readonly ok: false; readonly error: ContractError }

export type CallReading =
  | { readonly ok: true; readonly apply: (registry: RegistryState, owner: string) => Applied }
  | { readonly ok: false; readonly errors: readonly ContractError[] }

type Reading<Value> = { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly errors: readonly ContractError[] }
type Reader<Value> = (value: unknown) => Reading<Value>
type Readers<Args extends readonly unknown[]> = { readonly [Index in keyof Args]: Reader<Args[Index]> }

interface ExportDefinition {
  readonly readers: readonly Reader<unknown>[]
  readonly apply: (registry: RegistryState, owner: string, values: readonly unknown[]) => Applied
}

const ROOT_PATH = ''
const PATH_SEPARATOR = '.'
const FIRST_SUBMISSION_ID = 0

function refusal(code: ContractErrorCode, path: string = ROOT_PATH, detail?: string): readonly ContractError[] {
  return [detail === undefined ? { path, code } : { path, code, detail }]
}

function schema<Schema extends GenericSchema>(contract: Schema): Reader<InferOutput<Schema>> {
  return (value) => {
    const result = validateContract(contract, value)
    return result.status === ValidationStatus.Accepted ? { ok: true, value: result.value } : { ok: false, errors: result.errors }
  }
}

const submissionId: Reader<number> = (value) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return { ok: false, errors: refusal(ContractErrorCode.WrongType) }
  return value < FIRST_SUBMISSION_ID ? { ok: false, errors: refusal(ContractErrorCode.OutOfRange) } : { ok: true, value }
}

function define<Args extends readonly unknown[]>(readers: Readers<Args>, apply: (registry: RegistryState, owner: string, ...args: Args) => Applied): ExportDefinition {
  return { readers, apply: (registry, owner, values) => apply(registry, owner, ...(values as Args)) }
}

function issued(outcome: RegistryOutcome, toMessage: (commandSeq: number) => ToPageMessage): Applied {
  if (!outcome.ok) return outcome
  return { ok: true, registry: outcome.registry, messages: outcome.command === null ? [] : [toMessage(outcome.command.seq)] }
}

function plain(outcome: RegistryOutcome, toMessages: (registry: RegistryState) => readonly ToPageMessage[]): Applied {
  return outcome.ok ? { ok: true, registry: outcome.registry, messages: toMessages(outcome.registry) } : outcome
}

const radialEntries = (registry: RegistryState): readonly ToPageMessage[] => [{ type: ToPage.RadialEntries, entries: radialOrder(registry) }]

function hidden(registry: RegistryState, owner: string, promptId: string): Applied {
  const before = visiblePrompt(registry)
  return plain(hidePrompt(registry, owner, promptId), (after) => {
    if (after === registry) return []
    const hide: ToPageMessage = { type: ToPage.HidePrompt, promptId: namespaceId(owner, promptId) }
    const shown = visiblePrompt(after)
    return before?.owner === owner && before.prompt.id === promptId && shown !== null ? [hide, { type: ToPage.ShowPrompt, prompt: toPagePrompt(shown.owner, shown.prompt) }] : [hide]
  })
}

const panel = schema(PanelSchema)
const identifier = schema(IdentifierSchema)

const EXPORTS: ReadonlyMap<string, ExportDefinition> = new Map([
  [KitExport.OpenPanel, define([panel], (registry, owner, opened) =>
    issued(openPanel(registry, owner, opened), (commandSeq) => ({ type: ToPage.OpenPanel, commandSeq, panel: toPagePanel(owner, opened) })))],
  [KitExport.PushPanel, define([panel, identifier], (registry, owner, pushed, parentId) =>
    issued(pushPanel(registry, owner, pushed, parentId), (commandSeq) => ({ type: ToPage.PushPanel, commandSeq, panel: toPagePanel(owner, pushed), parentId: namespaceId(owner, parentId) })))],
  [KitExport.UpdatePanel, define([panel], (registry, owner, updated) =>
    plain(updatePanel(registry, owner, updated), () => [{ type: ToPage.UpdatePanel, panel: toPagePanel(owner, updated) }]))],
  [KitExport.ClosePanel, define([identifier], (registry, owner, panelId) =>
    issued(closePanel(registry, owner, panelId), (commandSeq) => ({ type: ToPage.ClosePanel, commandSeq, panelId: namespaceId(owner, panelId) })))],
  [KitExport.ResolveForm, define([identifier, submissionId, schema(FormResultSchema)], (registry, owner, panelId, submission, result): Applied => {
    const error = checkFormOwner(registry, owner, panelId)
    if (error !== null) return { ok: false, error }
    return { ok: true, registry, messages: [{ type: ToPage.ResolveForm, panelId: namespaceId(owner, panelId), submissionId: submission, result }] }
  })],
  [KitExport.Confirm, define([schema(ConfirmRequestSchema)], (registry, owner, request) =>
    issued(showConfirm(registry, owner, request), (commandSeq) => ({ type: ToPage.ShowConfirm, commandSeq, confirm: toPageConfirm(owner, request) })))],
  [KitExport.Notify, define([schema(NotificationSchema)], (registry, owner, notification): Applied =>
    ({ ok: true, registry, messages: [{ type: ToPage.Notify, notification: toPageNotification(owner, notification) }] }))],
  [KitExport.AddRadialEntry, define([schema(RadialEntrySchema)], (registry, owner, entry) => plain(addRadialEntry(registry, owner, entry), radialEntries))],
  [KitExport.RemoveRadialEntry, define([identifier], (registry, owner, entryId) => plain(removeRadialEntry(registry, owner, entryId), radialEntries))],
  [KitExport.ShowPrompt, define([schema(PromptSchema)], (registry, owner, prompt) =>
    plain(showPrompt(registry, owner, prompt), () => [{ type: ToPage.ShowPrompt, prompt: toPagePrompt(owner, prompt) }]))],
  [KitExport.HidePrompt, define([identifier], hidden)],
])

const atArgument = (index: number) => (error: ContractError): ContractError =>
  ({ ...error, path: error.path.length === 0 ? String(index) : `${index}${PATH_SEPARATOR}${error.path}` })

function readValues(readers: readonly Reader<unknown>[], list: readonly unknown[]): Reading<readonly unknown[]> {
  if (list.length > readers.length) return { ok: false, errors: refusal(ContractErrorCode.TooMany) }
  const values: unknown[] = []
  const errors: ContractError[] = []
  readers.forEach((reader, index) => {
    const reading: Reading<unknown> = index < list.length ? reader(list[index]) : { ok: false, errors: refusal(ContractErrorCode.Missing) }
    if (reading.ok) values.push(reading.value)
    else errors.push(...reading.errors.map(atArgument(index)))
  })
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: values }
}

export function readCall(name: unknown, args: unknown): CallReading {
  const definition = typeof name === 'string' ? EXPORTS.get(name) : undefined
  if (definition === undefined) return { ok: false, errors: refusal(ContractErrorCode.UnknownValue, ROOT_PATH, String(name)) }
  const normalized = normalizePayload(args)
  if (!normalized.ok) return normalized
  if (!Array.isArray(normalized.value)) return { ok: false, errors: refusal(ContractErrorCode.WrongType) }
  const values = readValues(definition.readers, normalized.value)
  return values.ok ? { ok: true, apply: (registry, owner) => definition.apply(registry, owner, values.value) } : values
}
