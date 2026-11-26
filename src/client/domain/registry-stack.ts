import type { ValueOf } from '@openmemorykit/core/shared'
import { STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import type { Panel } from '@openmemorykit/ui/contract'
import { namespaceId } from '../../protocol/namespaced-id'
import type { OwnedPanel } from '../../protocol/owned'
import { fromPageStackSnapshot } from '../../protocol/stack'
import type { StackEntry, StackSnapshot } from '../../protocol/stack'

export const StackCommandKind = { Open: 'open', Push: 'push', Close: 'close', DropOwner: 'dropOwner', ShowConfirm: 'showConfirm' } as const
export type StackCommandKind = ValueOf<typeof StackCommandKind>

export interface StackCommand {
  readonly kind: StackCommandKind
  readonly seq: number
  readonly owner: string
  readonly panel: OwnedPanel | null
  readonly panelId: string | null
}

export interface RegisteredPanel { readonly owner: string; readonly panel: Panel }

export interface StackState {
  readonly stack: readonly RegisteredPanel[]
  readonly commandSeq: number
  readonly unapplied: readonly StackCommand[]
}

export type CommandDraft = Omit<StackCommand, 'seq'>

export interface IssuedCommand<State extends StackState> {
  readonly registry: State
  readonly command: StackCommand
}

export const UNAPPLIED_COMMANDS_MAX = 256

export function issueCommand<State extends StackState>(registry: State, stack: readonly RegisteredPanel[], draft: CommandDraft): IssuedCommand<State> {
  const command: StackCommand = { ...draft, seq: registry.commandSeq + 1 }
  const unapplied = [...registry.unapplied, command].slice(-UNAPPLIED_COMMANDS_MAX)
  return { registry: { ...registry, stack, commandSeq: command.seq, unapplied }, command }
}

export function findPanel(stack: readonly RegisteredPanel[], owner: string, panelId: string): number {
  return stack.findIndex((registered) => registered.owner === owner && registered.panel.id === panelId)
}

export function topPanel(stack: readonly RegisteredPanel[]): RegisteredPanel | null {
  return stack[stack.length - 1] ?? null
}

function openedEntry(command: StackCommand): StackEntry | null {
  return command.panel === null ? null : { panelId: command.panel.panel.id, owner: command.owner }
}

function replayPush(entries: readonly StackEntry[], command: StackCommand): readonly StackEntry[] {
  const pushed = openedEntry(command)
  const parent = entries[entries.length - 1]
  if (pushed === null || parent === undefined || parent.panelId !== command.panelId || entries.length >= STACK_MAX_DEPTH) return entries
  return entries.some((entry) => entry.panelId === pushed.panelId) ? entries : [...entries, pushed]
}

function replayClose(entries: readonly StackEntry[], command: StackCommand): readonly StackEntry[] {
  const closedAt = entries.findIndex((entry) => entry.panelId === command.panelId)
  return closedAt < 0 ? entries : entries.slice(0, closedAt)
}

function replayCommand(entries: readonly StackEntry[], command: StackCommand): readonly StackEntry[] {
  switch (command.kind) {
    case StackCommandKind.Open: {
      const opened = openedEntry(command)
      return opened === null ? entries : [opened]
    }
    case StackCommandKind.Push:
      return replayPush(entries, command)
    case StackCommandKind.Close:
      return replayClose(entries, command)
    default:
      return entries
  }
}

function isReplayable(registry: StackState, appliedCommandSeq: number): boolean {
  const oldestReplayable = registry.commandSeq - registry.unapplied.length
  return appliedCommandSeq >= oldestReplayable && appliedCommandSeq <= registry.commandSeq
}

export function reconcileStack<State extends StackState>(registry: State, snapshot: StackSnapshot): State {
  const local = fromPageStackSnapshot(snapshot)
  if (local === null || !isReplayable(registry, local.appliedCommandSeq)) return registry
  const { appliedCommandSeq } = local
  const pending = registry.unapplied.filter((command) => command.seq > appliedCommandSeq)
  const applied: readonly StackEntry[] = local.entries.map(({ owner, localPanelId }) => ({ panelId: namespaceId(owner, localPanelId), owner }))
  const replayed = pending.reduce(replayCommand, applied)
  const known = new Map(registry.stack.map((registered) => [namespaceId(registered.owner, registered.panel.id), registered] as const))
  const stack = replayed.flatMap((entry) => known.get(entry.panelId) ?? [])
  return { ...registry, stack, unapplied: pending }
}
