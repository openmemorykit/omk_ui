import { STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import type { Reply } from '@openmemorykit/ui/contract'
import { fromPageStackEntry } from './owned'
import type { StackEntryOwner } from './owned'

export const STACK_SNAPSHOT_MAX_ENTRIES = STACK_MAX_DEPTH

export interface StackEntry {
  readonly panelId: string
  readonly owner: string
}

export interface StackSnapshot {
  readonly appliedCommandSeq: number
  readonly entries: readonly StackEntry[]
}

export interface OwnedReply {
  readonly owner: string
  readonly reply: Reply
}

export interface PageEvent {
  readonly stack: StackSnapshot | null
  readonly replies: readonly OwnedReply[]
}

export interface LocalStackSnapshot {
  readonly appliedCommandSeq: number
  readonly entries: readonly StackEntryOwner[]
}

const isCommandSeq = (value: unknown): boolean => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const isList = (value: unknown): boolean => Array.isArray(value)
const isRead = (entry: StackEntryOwner | null): entry is StackEntryOwner => entry !== null

function hasDistinctPanels(entries: readonly StackEntry[]): boolean {
  return new Set(entries.map((entry) => entry.panelId)).size === entries.length
}

export function fromPageStackSnapshot(snapshot: StackSnapshot): LocalStackSnapshot | null {
  if (typeof snapshot !== 'object' || snapshot === null) return null
  const { appliedCommandSeq, entries } = snapshot
  if (!isCommandSeq(appliedCommandSeq) || !isList(entries) || entries.length > STACK_SNAPSHOT_MAX_ENTRIES) return null
  const owners = entries.map(fromPageStackEntry)
  return owners.every(isRead) && hasDistinctPanels(entries) ? { appliedCommandSeq, entries: owners } : null
}
