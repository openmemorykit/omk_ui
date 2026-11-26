import { describe, expect, it } from 'vitest'
import { STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import { addRadialEntry, EMPTY_REGISTRY, openPanel, pushPanel } from '../../../src/client/domain/owner-registry'
import type { RegistryState } from '../../../src/client/domain/owner-registry'
import { reconcileStack, UNAPPLIED_COMMANDS_MAX } from '../../../src/client/domain/registry-stack'
import type { StackEntry } from '../../../src/protocol/stack'
import { FixtureOwner } from '../../fixtures/owned'
import { LIST_PANEL } from '../../fixtures/panels'
import { WHITELIST_RADIAL_ENTRY } from '../../fixtures/surfaces'
import { panelAt, registryAfter } from './registry-helpers'

const HUGE_LENGTH = 10_000_000
const HUGE_ENTRY_COUNT = 1_000_000
const HUGE_BUDGET_MS = 10
const REPLAY_BUDGET_MS = 10

const { Whitelist } = FixtureOwner
const hugeText = 'a'.repeat(HUGE_LENGTH)

function measure(action: () => void): number {
  action()
  const start = performance.now()
  action()
  return performance.now() - start
}

function fullStackWithPendingCommands(): RegistryState {
  const reopened = Array.from({ length: UNAPPLIED_COMMANDS_MAX - STACK_MAX_DEPTH + 1 }, (_unused, index) => index).reduce(
    (registry) => registryAfter(openPanel(registry, Whitelist, panelAt(0))),
    EMPTY_REGISTRY,
  )
  return Array.from({ length: STACK_MAX_DEPTH - 1 }, (_unused, level) => level + 1).reduce(
    (registry, level) => registryAfter(pushPanel(registry, Whitelist, panelAt(level), panelAt(level - 1).id)),
    reopened,
  )
}

describe('worst cases of the registry', () => {
  it('refuses a snapshot of a million entries without reading them', () => {
    const entries: readonly StackEntry[] = Array.from({ length: HUGE_ENTRY_COUNT }, (_unused, index) => ({ panelId: `whitelist/level-${index}`, owner: Whitelist }))
    let result: RegistryState | null = null
    expect(measure(() => { result = reconcileStack(EMPTY_REGISTRY, { appliedCommandSeq: 0, entries }) })).toBeLessThan(HUGE_BUDGET_MS)
    expect(result).toBe(EMPTY_REGISTRY)
  })

  it('refuses eight entries of 10 MB ids', () => {
    const entries: readonly StackEntry[] = Array.from({ length: STACK_MAX_DEPTH }, () => ({ panelId: `whitelist/${hugeText}`, owner: hugeText }))
    let result: RegistryState | null = null
    expect(measure(() => { result = reconcileStack(EMPTY_REGISTRY, { appliedCommandSeq: 0, entries }) })).toBeLessThan(HUGE_BUDGET_MS)
    expect(result).toBe(EMPTY_REGISTRY)
  })

  it('refuses a 10 MB owner and a 10 MB local id', () => {
    expect(measure(() => { addRadialEntry(EMPTY_REGISTRY, hugeText, WHITELIST_RADIAL_ENTRY) })).toBeLessThan(HUGE_BUDGET_MS)
    expect(measure(() => { openPanel(EMPTY_REGISTRY, Whitelist, { ...LIST_PANEL, id: hugeText }) })).toBeLessThan(HUGE_BUDGET_MS)
  })

  it('replays every kept command on a full stack within budget', () => {
    const registry = fullStackWithPendingCommands()
    expect(registry.unapplied).toHaveLength(UNAPPLIED_COMMANDS_MAX)
    const oldest = registry.commandSeq - UNAPPLIED_COMMANDS_MAX
    let result: RegistryState = EMPTY_REGISTRY
    expect(measure(() => { result = reconcileStack(registry, { appliedCommandSeq: oldest, entries: [] }) })).toBeLessThan(REPLAY_BUDGET_MS)
    expect(result.stack).toStrictEqual(registry.stack)
  })
})
