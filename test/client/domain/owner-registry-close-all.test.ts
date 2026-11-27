import { describe, expect, it } from 'vitest'
import { closeAll, EMPTY_REGISTRY, openPanel, pushPanel, showConfirm, StackCommandKind } from '../../../src/client/domain/owner-registry'
import { reconcileStack } from '../../../src/client/domain/registry-stack'
import { FixtureOwner } from '../../fixtures/owned'
import { ADD_PANEL, LIST_PANEL } from '../../fixtures/panels'
import { SHARED_STACK_SEQ, SHARED_STACK_SNAPSHOT } from '../../fixtures/stack'
import { REMOVE_CONFIRM } from '../../fixtures/surfaces'
import { registryAfter } from './registry-helpers'

const { Whitelist } = FixtureOwner
const CLOSE_ALL_SEQ = SHARED_STACK_SEQ.Push + 1

const withListAndAdd = registryAfter(pushPanel(registryAfter(openPanel(EMPTY_REGISTRY, Whitelist, LIST_PANEL)), Whitelist, ADD_PANEL, LIST_PANEL.id))

describe('closeAll', () => {
  it('empties the stack with one numbered command that belongs to no owner', () => {
    const closed = closeAll(withListAndAdd)
    expect(closed.command).toStrictEqual({ kind: StackCommandKind.CloseAll, seq: CLOSE_ALL_SEQ })
    expect(closed.registry.stack).toStrictEqual([])
    expect(closed.registry.commandSeq).toBe(CLOSE_ALL_SEQ)
  })

  it('keeps the confirmations until the page answers them', () => {
    const confirming = registryAfter(showConfirm(EMPTY_REGISTRY, Whitelist, REMOVE_CONFIRM))
    const closed = closeAll(confirming)
    expect(closed.command?.kind).toBe(StackCommandKind.CloseAll)
    expect(closed.registry.confirms).toStrictEqual(confirming.confirms)
  })

  it('issues no command when nothing is open', () => {
    expect(closeAll(EMPTY_REGISTRY)).toStrictEqual({ registry: EMPTY_REGISTRY, command: null })
  })

  it('is replayed as an empty stack over an older snapshot', () => {
    const closed = closeAll(withListAndAdd).registry
    expect(reconcileStack(closed, SHARED_STACK_SNAPSHOT).stack).toStrictEqual([])
  })
})
