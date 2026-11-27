import { describe, expect, it } from 'vitest'
import { ReplyKind } from '@openmemorykit/ui/contract'
import { LOCAL_ID_MAX_LENGTH, OWNER_MAX_LENGTH, splitNamespacedId } from '../../src/protocol/namespaced-id'
import { fromPageReply, fromPageStackEntry } from '../../src/protocol/owned'
import { fromPageStackSnapshot, STACK_SNAPSHOT_MAX_ENTRIES } from '../../src/protocol/stack'
import type { StackEntry } from '../../src/protocol/stack'
import { FixtureOwner } from '../fixtures/owned'
import { PAGE_REPLIES } from '../fixtures/replies'

const HUGE_LENGTH = 10_000_000
const HUGE_ENTRY_COUNT = 1_000_000
const REPEATED_CALLS = 100_000
const HUGE_BUDGET_MS = 10
const REPEATED_BUDGET_MS = 1000

const hugeText = 'a'.repeat(HUGE_LENGTH)
const hugeSlashes = '/'.repeat(HUGE_LENGTH)
const longestValid = `${'a'.repeat(OWNER_MAX_LENGTH)}/${'a'.repeat(LOCAL_ID_MAX_LENGTH)}`

function measure(action: () => void): number {
  action()
  const start = performance.now()
  action()
  return performance.now() - start
}

describe('worst cases from the page', () => {
  it.each([
    ['a 10 MB id without separator', hugeText],
    ['a 10 MB id of separators', hugeSlashes],
    ['a 10 MB id with a valid prefix', `whitelist/${hugeText}`],
  ])('refuses %s within budget', (_name, namespaced) => {
    let result: unknown = {}
    expect(measure(() => { result = splitNamespacedId(namespaced) })).toBeLessThan(HUGE_BUDGET_MS)
    expect(result).toBeNull()
  })

  it('refuses a snapshot of a million entries within budget', () => {
    const entries: readonly StackEntry[] = Array.from({ length: HUGE_ENTRY_COUNT }, (_unused, index) => ({ panelId: `whitelist/level-${index}`, owner: FixtureOwner.Whitelist }))
    let result: unknown = {}
    expect(measure(() => { result = fromPageStackSnapshot({ appliedCommandSeq: 1, entries }) })).toBeLessThan(HUGE_BUDGET_MS)
    expect(result).toBeNull()
  })

  it('refuses a full snapshot whose ids are 10 MB each', () => {
    const entries: readonly StackEntry[] = Array.from({ length: STACK_SNAPSHOT_MAX_ENTRIES }, () => ({ panelId: `whitelist/${hugeText}`, owner: FixtureOwner.Whitelist }))
    let result: unknown = {}
    expect(measure(() => { result = fromPageStackSnapshot({ appliedCommandSeq: 1, entries }) })).toBeLessThan(HUGE_BUDGET_MS)
    expect(result).toBeNull()
  })

  it('refuses a stack entry and a reply whose owner and target are 10 MB', () => {
    let entry: unknown = {}
    let reply: unknown = {}
    expect(measure(() => { entry = fromPageStackEntry({ panelId: hugeText, owner: hugeText }) })).toBeLessThan(HUGE_BUDGET_MS)
    expect(measure(() => { reply = fromPageReply({ owner: hugeText, reply: { ...PAGE_REPLIES[ReplyKind.PanelClosed], panelId: hugeText } }) })).toBeLessThan(HUGE_BUDGET_MS)
    expect(entry).toBeNull()
    expect(reply).toBeNull()
  })

  it('splits the longest valid id a hundred thousand times within budget', () => {
    let accepted = 0
    const elapsed = measure(() => {
      accepted = 0
      for (let call = 0; call < REPEATED_CALLS; call += 1) if (splitNamespacedId(longestValid) !== null) accepted += 1
    })
    expect(elapsed).toBeLessThan(REPEATED_BUDGET_MS)
    expect(accepted).toBe(REPEATED_CALLS)
  })
})
