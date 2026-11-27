import type { ValueOf } from '@openmemorykit/core/shared'
import { CONFIRMS_PER_OWNER, ContractErrorCode, IdentifierSchema, PanelKind, PROMPTS_PER_OWNER, RADIAL_ENTRIES_PER_OWNER, RADIAL_MAX_SECTORS, STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import type { ConfirmRequest, ContractError, Panel, Prompt, RadialEntry } from '@openmemorykit/ui/contract'
import * as v from 'valibot'
import { isNamespaceOwner, namespaceId } from '../../protocol/namespaced-id'
import { toPagePanel, toPageRadialEntry } from '../../protocol/owned'
import type { OwnedRadialEntry } from '../../protocol/owned'
import { findPanel, issueCommand, pageAppliedCommandSeq, StackCommandKind, topPanel } from './registry-stack'
import type { IssuedCommand, StackCommand, StackState } from './registry-stack'

export { reconcileStack, StackCommandKind } from './registry-stack'
export type { RegisteredPanel, StackCommand } from './registry-stack'

export interface RegisteredConfirm { readonly owner: string; readonly confirm: ConfirmRequest; readonly seq: number }
export interface RegisteredPrompt { readonly owner: string; readonly prompt: Prompt }
export interface RegisteredRadialEntry { readonly owner: string; readonly entry: RadialEntry }

export interface RegistryState extends StackState {
  readonly radialEntries: readonly RegisteredRadialEntry[]
  readonly confirms: readonly RegisteredConfirm[]
  readonly prompts: readonly RegisteredPrompt[]
}

export type RegistryOutcome =
  | { readonly ok: true; readonly registry: RegistryState; readonly command: StackCommand | null }
  | { readonly ok: false; readonly error: ContractError }

export interface RegistryChange { readonly registry: RegistryState; readonly command: StackCommand | null }

export const RegistryErrorPath = { Root: '', Id: 'id' } as const
export type RegistryErrorPath = ValueOf<typeof RegistryErrorPath>

export const RADIAL_FULL_OWNER_SEPARATOR = ','

export const EMPTY_REGISTRY: RegistryState = Object.freeze({
  radialEntries: Object.freeze([]),
  stack: Object.freeze([]),
  confirms: Object.freeze([]),
  prompts: Object.freeze([]),
  commandSeq: 0,
  unapplied: Object.freeze([]),
})

interface Owned { readonly owner: string }

function refused(code: ContractErrorCode, path: RegistryErrorPath = RegistryErrorPath.Root, detail?: string): RegistryOutcome {
  return { ok: false, error: detail === undefined ? { path, code } : { path, code, detail } }
}

const withoutCommand = (registry: RegistryState): RegistryOutcome => ({ ok: true, registry, command: null })
const withCommand = ({ registry, command }: IssuedCommand<RegistryState>): RegistryOutcome => ({ ok: true, registry, command })
const countOf = (items: readonly Owned[], owner: string): number => items.filter((item) => item.owner === owner).length
const othersThan = <Item extends Owned>(items: readonly Item[], owner: string): readonly Item[] => items.filter((item) => item.owner !== owner)
const holdsAnything = (registry: RegistryState, owner: string): boolean =>
  [registry.radialEntries, registry.stack, registry.confirms, registry.prompts].some((items) => items.some((item) => item.owner === owner))

function identityRefusal(owner: string, localId: string): RegistryOutcome | null {
  if (!isNamespaceOwner(owner)) return refused(ContractErrorCode.BadIdentifier)
  return v.is(IdentifierSchema, localId) ? null : refused(ContractErrorCode.BadIdentifier, RegistryErrorPath.Id)
}

function isOccupiedFor(registry: RegistryState, owner: string): boolean {
  return othersThan(registry.stack, owner).length > 0 || othersThan(registry.confirms, owner).length > 0
}

function presentOwners(entries: readonly RegisteredRadialEntry[]): string {
  return Array.from(new Set(entries.map(({ owner }) => owner))).sort().join(RADIAL_FULL_OWNER_SEPARATOR)
}

export function addRadialEntry(registry: RegistryState, owner: string, entry: RadialEntry): RegistryOutcome {
  const invalid = identityRefusal(owner, entry.id)
  if (invalid !== null) return invalid
  const entries = registry.radialEntries
  const replacedAt = entries.findIndex((registered) => registered.owner === owner && registered.entry.id === entry.id)
  if (replacedAt >= 0) return withoutCommand({ ...registry, radialEntries: entries.map((registered, index) => (index === replacedAt ? { owner, entry } : registered)) })
  if (countOf(entries, owner) >= RADIAL_ENTRIES_PER_OWNER) return refused(ContractErrorCode.QuotaExceeded)
  if (entries.length >= RADIAL_MAX_SECTORS) return refused(ContractErrorCode.RadialFull, RegistryErrorPath.Root, presentOwners(entries))
  return withoutCommand({ ...registry, radialEntries: [...entries, { owner, entry }] })
}

export function removeRadialEntry(registry: RegistryState, owner: string, entryId: string): RegistryOutcome {
  const radialEntries = registry.radialEntries.filter((registered) => registered.owner !== owner || registered.entry.id !== entryId)
  return withoutCommand(radialEntries.length === registry.radialEntries.length ? registry : { ...registry, radialEntries })
}

export function openPanel(registry: RegistryState, owner: string, panel: Panel): RegistryOutcome {
  const invalid = identityRefusal(owner, panel.id)
  if (invalid !== null) return invalid
  if (isOccupiedFor(registry, owner)) return refused(ContractErrorCode.Occupied)
  const withoutOwnConfirms = { ...registry, confirms: othersThan(registry.confirms, owner) }
  return withCommand(issueCommand(withoutOwnConfirms, [{ owner, panel }], { kind: StackCommandKind.Open, owner, panel: toPagePanel(owner, panel) }))
}

export function pushPanel(registry: RegistryState, owner: string, panel: Panel, parentId: string): RegistryOutcome {
  const invalid = identityRefusal(owner, panel.id)
  if (invalid !== null) return invalid
  const parent = topPanel(registry.stack)
  if (parent === null || parent.owner !== owner || parent.panel.id !== parentId) return refused(ContractErrorCode.NotOwner)
  if (findPanel(registry.stack, owner, panel.id) >= 0) return refused(ContractErrorCode.AlreadyOpen, RegistryErrorPath.Id)
  if (registry.stack.length >= STACK_MAX_DEPTH) return refused(ContractErrorCode.StackFull)
  const draft = { kind: StackCommandKind.Push, owner, panel: toPagePanel(owner, panel), parentId: namespaceId(owner, parentId) } as const
  return withCommand(issueCommand(registry, [...registry.stack, { owner, panel }], draft))
}

export function updatePanel(registry: RegistryState, owner: string, panel: Panel): RegistryOutcome {
  const updatedAt = findPanel(registry.stack, owner, panel.id)
  if (updatedAt < 0) return refused(ContractErrorCode.UnknownPanel, RegistryErrorPath.Id)
  return withoutCommand({ ...registry, stack: registry.stack.map((registered, index) => (index === updatedAt ? { owner, panel } : registered)) })
}

export function closePanel(registry: RegistryState, owner: string, panelId: string): RegistryOutcome {
  const closedAt = findPanel(registry.stack, owner, panelId)
  if (closedAt < 0) return withoutCommand(registry)
  const draft = { kind: StackCommandKind.Close, owner, panelId: namespaceId(owner, panelId) } as const
  return withCommand(issueCommand(registry, registry.stack.slice(0, closedAt), draft))
}

export function checkFormOwner(registry: RegistryState, owner: string, panelId: string): ContractError | null {
  const registered = registry.stack[findPanel(registry.stack, owner, panelId)]
  return registered?.panel.kind === PanelKind.Form ? null : { path: RegistryErrorPath.Root, code: ContractErrorCode.UnknownPanel }
}

export function showConfirm(registry: RegistryState, owner: string, confirm: ConfirmRequest): RegistryOutcome {
  const invalid = identityRefusal(owner, confirm.id)
  if (invalid !== null) return invalid
  if (isOccupiedFor(registry, owner)) return refused(ContractErrorCode.Occupied)
  if (countOf(registry.confirms, owner) >= CONFIRMS_PER_OWNER) return refused(ContractErrorCode.QuotaExceeded)
  const issued = issueCommand(registry, registry.stack, { kind: StackCommandKind.ShowConfirm, owner })
  const confirms = [...registry.confirms, { owner, confirm, seq: issued.command.seq }]
  return withCommand({ registry: { ...issued.registry, confirms }, command: issued.command })
}

export function settleConfirm(registry: RegistryState, owner: string, confirmId: string): RegistryState {
  const appliedSeq = pageAppliedCommandSeq(registry)
  const isAnswered = (registered: RegisteredConfirm): boolean => registered.owner === owner && registered.confirm.id === confirmId && registered.seq <= appliedSeq
  const confirms = registry.confirms.filter((registered) => !isAnswered(registered))
  return confirms.length === registry.confirms.length ? registry : { ...registry, confirms }
}

export function showPrompt(registry: RegistryState, owner: string, prompt: Prompt): RegistryOutcome {
  const invalid = identityRefusal(owner, prompt.id)
  if (invalid !== null) return invalid
  const others = registry.prompts.filter((registered) => registered.owner !== owner || registered.prompt.id !== prompt.id)
  if (countOf(others, owner) >= PROMPTS_PER_OWNER) return refused(ContractErrorCode.QuotaExceeded)
  return withoutCommand({ ...registry, prompts: [...others, { owner, prompt }] })
}

export function hidePrompt(registry: RegistryState, owner: string, promptId: string): RegistryOutcome {
  const prompts = registry.prompts.filter((registered) => registered.owner !== owner || registered.prompt.id !== promptId)
  return withoutCommand(prompts.length === registry.prompts.length ? registry : { ...registry, prompts })
}

export function dropOwner(registry: RegistryState, owner: string): RegistryChange {
  if (!holdsAnything(registry, owner)) return { registry, command: null }
  const remaining = {
    ...registry,
    radialEntries: othersThan(registry.radialEntries, owner),
    confirms: othersThan(registry.confirms, owner),
    prompts: othersThan(registry.prompts, owner),
  }
  return issueCommand(remaining, othersThan(registry.stack, owner), { kind: StackCommandKind.DropOwner, owner })
}

export function closeAll(registry: RegistryState): RegistryChange {
  if (registry.stack.length === 0 && registry.confirms.length === 0) return { registry, command: null }
  return issueCommand(registry, [], { kind: StackCommandKind.CloseAll })
}

const compareText = (left: string, right: string): number => (left < right ? -1 : Number(left > right))

function compareEntries(left: RegisteredRadialEntry, right: RegisteredRadialEntry): number {
  return compareText(left.owner, right.owner) || compareText(left.entry.id, right.entry.id)
}

export function radialOrder(registry: RegistryState): readonly OwnedRadialEntry[] {
  return [...registry.radialEntries].sort(compareEntries).map(({ owner, entry }) => toPageRadialEntry(owner, entry))
}

export function visiblePrompt(registry: RegistryState): RegisteredPrompt | null {
  return registry.prompts[registry.prompts.length - 1] ?? null
}
