import { describe, expect, it } from 'vitest'
import { ContractErrorCode, STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import { checkFormOwner, closePanel, dropOwner, EMPTY_REGISTRY, openPanel, pushPanel, showConfirm } from '../../../src/client/domain/owner-registry'
import type { RegistryState } from '../../../src/client/domain/owner-registry'
import { reconcileStack, UNAPPLIED_COMMANDS_MAX } from '../../../src/client/domain/registry-stack'
import type { StackEntry, StackSnapshot } from '../../../src/protocol/stack'
import { FixtureOwner, HOSTILE_NAMESPACED_IDS } from '../../fixtures/owned'
import { ADD_PANEL, LIST_PANEL } from '../../fixtures/panels'
import { SHARED_STACK_PANELS, SHARED_STACK_SEQ, SHARED_STACK_SNAPSHOT } from '../../fixtures/stack'
import { REMOVE_CONFIRM } from '../../fixtures/surfaces'
import { panelAt, registryAfter } from './registry-helpers'

const { Whitelist, Garage } = FixtureOwner
const LIST_ENTRY: StackEntry = { panelId: 'whitelist/list', owner: Whitelist }
const ADD_ENTRY: StackEntry = { panelId: 'whitelist/add', owner: Whitelist }
const FRACTION = 1.5
const SECOND_LEVEL = 2

const snapshotOf = (appliedCommandSeq: number, entries: readonly StackEntry[]): StackSnapshot => ({ appliedCommandSeq, entries })
const withList = registryAfter(openPanel(EMPTY_REGISTRY, Whitelist, LIST_PANEL))
const withListAndAdd = registryAfter(pushPanel(withList, Whitelist, ADD_PANEL, LIST_PANEL.id))

describe('reconcileStack', () => {
  it('rebuilds the shared stack from the shared snapshot and forgets the applied commands', () => {
    const reconciled = reconcileStack(withListAndAdd, SHARED_STACK_SNAPSHOT)
    expect(reconciled.stack).toStrictEqual(SHARED_STACK_PANELS)
    expect(reconciled.unapplied).toStrictEqual([])
    expect(reconciled.commandSeq).toBe(SHARED_STACK_SEQ.Push)
  })

  it('replays the commands the page has not applied yet', () => {
    const reconciled = reconcileStack(withListAndAdd, snapshotOf(SHARED_STACK_SEQ.Open, [LIST_ENTRY]))
    expect(reconciled.stack).toStrictEqual(SHARED_STACK_PANELS)
    expect(reconciled.unapplied).toStrictEqual(withListAndAdd.unapplied.slice(1))
  })

  it('keeps what the player closed closed, and no longer accepts its form', () => {
    const reconciled = reconcileStack(withListAndAdd, snapshotOf(SHARED_STACK_SEQ.Push, [LIST_ENTRY]))
    expect(reconciled.stack).toStrictEqual([{ owner: Whitelist, panel: LIST_PANEL }])
    expect(checkFormOwner(withListAndAdd, Whitelist, ADD_PANEL.id)).toBeNull()
    expect(checkFormOwner(reconciled, Whitelist, ADD_PANEL.id)?.code).toBe(ContractErrorCode.UnknownPanel)
  })

  it('drops a replayed push whose parent the player closed, as the page does', () => {
    expect(reconcileStack(withListAndAdd, snapshotOf(SHARED_STACK_SEQ.Open, [])).stack).toStrictEqual([])
  })

  it('drops a replayed push whose parent is no longer on top', () => {
    const deeper = registryAfter(pushPanel(withListAndAdd, Whitelist, panelAt(1), ADD_PANEL.id))
    expect(reconcileStack(deeper, snapshotOf(SHARED_STACK_SEQ.Push, [LIST_ENTRY])).stack).toStrictEqual([{ owner: Whitelist, panel: LIST_PANEL }])
  })

  it('never replays a push of an id already in the stack', () => {
    const reversed = [{ owner: Whitelist, panel: ADD_PANEL }, { owner: Whitelist, panel: LIST_PANEL }]
    expect(reconcileStack(withListAndAdd, snapshotOf(SHARED_STACK_SEQ.Open, [ADD_ENTRY, LIST_ENTRY])).stack).toStrictEqual(reversed)
  })

  it('replays a push only below the depth limit and for an absent id', () => {
    const levels = Array.from({ length: STACK_MAX_DEPTH }, (_unused, level): StackEntry => ({ panelId: `whitelist/level-${level}`, owner: Whitelist }))
    const deepest = registryAfter(closePanel(withListAndAdd, Whitelist, ADD_PANEL.id))
    const reopened = registryAfter(pushPanel(deepest, Whitelist, ADD_PANEL, LIST_PANEL.id))
    const full = snapshotOf(SHARED_STACK_SEQ.Push, [...levels.slice(1), LIST_ENTRY])
    expect(reconcileStack(reopened, full).stack).toStrictEqual([{ owner: Whitelist, panel: LIST_PANEL }])
    const twice = snapshotOf(SHARED_STACK_SEQ.Push + 1, [LIST_ENTRY, ADD_ENTRY])
    expect(reconcileStack(reopened, twice).stack).toStrictEqual(SHARED_STACK_PANELS)
  })

  it('replays a close as a cut of the stack before the commands that follow it', () => {
    const threeLevels = registryAfter(pushPanel(withListAndAdd, Whitelist, panelAt(1), ADD_PANEL.id))
    const closed = registryAfter(closePanel(threeLevels, Whitelist, ADD_PANEL.id))
    const levelTwo = panelAt(SECOND_LEVEL)
    const pushed = registryAfter(pushPanel(closed, Whitelist, levelTwo, LIST_PANEL.id))
    const levelOne: StackEntry = { panelId: 'whitelist/level-1', owner: Whitelist }
    const reconciled = reconcileStack(pushed, snapshotOf(threeLevels.commandSeq, [LIST_ENTRY, ADD_ENTRY, levelOne]))
    expect(reconciled.stack).toStrictEqual([{ owner: Whitelist, panel: LIST_PANEL }, { owner: Whitelist, panel: levelTwo }])
  })

  it('replays a close, an open and a drop of the owner', () => {
    const closed = registryAfter(closePanel(withList, Whitelist, LIST_PANEL.id))
    expect(reconcileStack(closed, snapshotOf(SHARED_STACK_SEQ.Open, [LIST_ENTRY])).stack).toStrictEqual([])
    const reopened = registryAfter(openPanel(withListAndAdd, Whitelist, LIST_PANEL))
    expect(reconcileStack(reopened, SHARED_STACK_SNAPSHOT).stack).toStrictEqual([{ owner: Whitelist, panel: LIST_PANEL }])
    const dropped = dropOwner(withListAndAdd, Whitelist).registry
    expect(reconcileStack(dropped, SHARED_STACK_SNAPSHOT).stack).toStrictEqual([])
  })

  it('leaves the stack alone when replaying a confirmation', () => {
    const confirming = registryAfter(showConfirm(withListAndAdd, Whitelist, REMOVE_CONFIRM))
    expect(reconcileStack(confirming, SHARED_STACK_SNAPSHOT).stack).toStrictEqual(SHARED_STACK_PANELS)
  })

  it('drops entries the registry never opened', () => {
    const foreign = snapshotOf(SHARED_STACK_SEQ.Push, [LIST_ENTRY, { panelId: 'garage/list', owner: Garage }, { panelId: 'whitelist/other', owner: Whitelist }])
    expect(reconcileStack(withListAndAdd, foreign).stack).toStrictEqual([{ owner: Whitelist, panel: LIST_PANEL }])
  })

  it.each<readonly [string, StackSnapshot]>([
    ['nine entries', snapshotOf(SHARED_STACK_SEQ.Push, Array.from({ length: STACK_MAX_DEPTH + 1 }, () => LIST_ENTRY).map((entry, level) => ({ ...entry, panelId: `whitelist/level-${level}` })))],
    ['a duplicate entry', snapshotOf(SHARED_STACK_SEQ.Push, [LIST_ENTRY, LIST_ENTRY])],
    ['a negative command number', snapshotOf(-1, [])],
    ['a fractional command number', snapshotOf(FRACTION, [])],
    ['a command number that is not a number', { appliedCommandSeq: '2', entries: [] } as unknown as StackSnapshot],
    ['a command number never sent', snapshotOf(SHARED_STACK_SEQ.Push + 1, [])],
    ['an entry of an owner that does not match its prefix', snapshotOf(SHARED_STACK_SEQ.Push, [{ panelId: 'whitelist/list', owner: Garage }])],
    ['a snapshot that is not an object', null as unknown as StackSnapshot],
    ...HOSTILE_NAMESPACED_IDS.map((panelId, index) => [`hostile id number ${index}`, snapshotOf(SHARED_STACK_SEQ.Push, [{ panelId, owner: Whitelist }])] as const),
  ])('keeps the registry unchanged on %s', (_case, snapshot) => {
    expect(reconcileStack(withListAndAdd, snapshot)).toBe(withListAndAdd)
  })

  it('keeps the registry unchanged on a snapshot older than one already reconciled', () => {
    const reconciled = reconcileStack(withListAndAdd, SHARED_STACK_SNAPSHOT)
    expect(reconcileStack(reconciled, snapshotOf(SHARED_STACK_SEQ.Open, []))).toBe(reconciled)
  })
})

describe('unapplied commands', () => {
  const flood = (count: number): RegistryState =>
    Array.from({ length: count }, (_unused, index) => index).reduce((registry) => registryAfter(openPanel(registry, Whitelist, panelAt(registry.commandSeq))), EMPTY_REGISTRY)

  const OVERFLOW = 2
  const flooded = flood(UNAPPLIED_COMMANDS_MAX + OVERFLOW)

  it('keep at most the most recent commands', () => {
    expect(flooded.unapplied).toHaveLength(UNAPPLIED_COMMANDS_MAX)
    expect(flooded.unapplied.map(({ seq }) => seq)).toStrictEqual(Array.from({ length: UNAPPLIED_COMMANDS_MAX }, (_unused, index) => OVERFLOW + index + 1))
  })

  it('cannot replay a snapshot older than the kept commands', () => {
    expect(reconcileStack(flooded, snapshotOf(OVERFLOW - 1, []))).toBe(flooded)
    expect(reconcileStack(flooded, snapshotOf(OVERFLOW, [])).stack).toStrictEqual(flooded.stack)
  })
})
