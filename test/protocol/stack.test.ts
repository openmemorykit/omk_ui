import { describe, expect, it } from 'vitest'
import { STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import { fromPageStackSnapshot, STACK_SNAPSHOT_MAX_ENTRIES } from '../../src/protocol/stack'
import type { StackEntry, StackSnapshot } from '../../src/protocol/stack'
import { FixtureOwner } from '../fixtures/owned'
import { SHARED_STACK_PANELS, SHARED_STACK_SEQ, SHARED_STACK_SNAPSHOT } from '../fixtures/stack'

const FRACTION = 1.5

const entryAt = (level: number): StackEntry => ({ panelId: `whitelist/level-${level}`, owner: FixtureOwner.Whitelist })
const snapshotOf = (entries: readonly StackEntry[], appliedCommandSeq: number = SHARED_STACK_SEQ.Push): StackSnapshot => ({ appliedCommandSeq, entries })
const levels = (count: number): readonly StackEntry[] => Array.from({ length: count }, (_unused, level) => entryAt(level))

describe('fromPageStackSnapshot', () => {
  it('reads the shared snapshot as the local ids of the shared stack panels', () => {
    expect(fromPageStackSnapshot(SHARED_STACK_SNAPSHOT)).toStrictEqual({
      appliedCommandSeq: SHARED_STACK_SEQ.Push,
      entries: SHARED_STACK_PANELS.map(({ owner, panel }) => ({ owner, localPanelId: panel.id })),
    })
  })

  it('reads an empty stack', () => {
    expect(fromPageStackSnapshot(snapshotOf([], 0))).toStrictEqual({ appliedCommandSeq: 0, entries: [] })
  })

  it('is bounded by the stack depth of the page', () => {
    expect(STACK_SNAPSHOT_MAX_ENTRIES).toBe(STACK_MAX_DEPTH)
    expect(fromPageStackSnapshot(snapshotOf(levels(STACK_SNAPSHOT_MAX_ENTRIES)))?.entries).toHaveLength(STACK_SNAPSHOT_MAX_ENTRIES)
    expect(fromPageStackSnapshot(snapshotOf(levels(STACK_SNAPSHOT_MAX_ENTRIES + 1)))).toBeNull()
  })

  it('checks the length before reading any entry', () => {
    const reads: number[] = []
    const entries = levels(STACK_SNAPSHOT_MAX_ENTRIES + 1).map((entry, index) => ({
      owner: entry.owner,
      get panelId(): string {
        reads.push(index)
        return entry.panelId
      },
    }))
    expect(fromPageStackSnapshot(snapshotOf(entries))).toBeNull()
    expect(reads).toStrictEqual([])
  })

  it('refuses a stack with an entry it cannot read', () => {
    expect(fromPageStackSnapshot(snapshotOf([entryAt(0), { panelId: 'level-1', owner: FixtureOwner.Whitelist }]))).toBeNull()
    expect(fromPageStackSnapshot(snapshotOf([entryAt(0), { panelId: 'garage/level-1', owner: FixtureOwner.Whitelist }]))).toBeNull()
  })

  it('refuses the same panel twice', () => {
    expect(fromPageStackSnapshot(snapshotOf([entryAt(0), entryAt(0)]))).toBeNull()
  })

  it.each([-1, FRACTION, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '2', null])('refuses the applied command number %j', (appliedCommandSeq) => {
    expect(fromPageStackSnapshot(snapshotOf([], appliedCommandSeq as number))).toBeNull()
  })

  it.each([null, [], 'stack', { appliedCommandSeq: 0 }, { appliedCommandSeq: 0, entries: {} }, { appliedCommandSeq: 0, entries: { length: 1, 0: entryAt(0) } }])(
    'refuses the malformed snapshot %j',
    (snapshot) => {
      expect(fromPageStackSnapshot(snapshot as unknown as StackSnapshot)).toBeNull()
    },
  )
})
