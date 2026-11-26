import { describe, expect, it } from 'vitest'
import { EMPTY_REGISTRY, openPanel } from '../../../src/client/domain/owner-registry'
import type { RegistryState } from '../../../src/client/domain/owner-registry'
import { reconcileStack, StackCommandKind, type StackCommand } from '../../../src/client/domain/registry-stack'
import type { StackEntry, StackSnapshot } from '../../../src/protocol/stack'
import { FixtureOwner } from '../../fixtures/owned'
import { ADD_PANEL, LIST_PANEL } from '../../fixtures/panels'
import { registryAfter } from './registry-helpers'

const { Whitelist } = FixtureOwner
const LIST_ENTRY: StackEntry = { panelId: 'whitelist/list', owner: Whitelist }
const FIRST_SEQ = 1
const PANELLESS_SEQ = 2

const withList = registryAfter(openPanel(EMPTY_REGISTRY, Whitelist, LIST_PANEL))

function paneless(kind: StackCommandKind, panelId: string | null): StackCommand {
  return { kind, seq: PANELLESS_SEQ, owner: Whitelist, panel: null, panelId }
}

function replayedWith(command: StackCommand): RegistryState {
  const registry: RegistryState = { ...withList, commandSeq: PANELLESS_SEQ, unapplied: [...withList.unapplied, command] }
  const snapshot: StackSnapshot = { appliedCommandSeq: FIRST_SEQ, entries: [LIST_ENTRY] }
  return reconcileStack(registry, snapshot)
}

describe('replaying commands that carry no panel', () => {
  it('leaves the stack as the page reported it when an open has no panel to open', () => {
    const reconciled = replayedWith(paneless(StackCommandKind.Open, null))
    expect(reconciled.stack.map((registered) => registered.panel.id)).toEqual([LIST_PANEL.id])
  })

  it('does not push a panel that is missing from the command', () => {
    const reconciled = replayedWith(paneless(StackCommandKind.Push, LIST_PANEL.id))
    expect(reconciled.stack.map((registered) => registered.panel.id)).toEqual([LIST_PANEL.id])
    expect(reconciled.stack.map((registered) => registered.panel.id)).not.toContain(ADD_PANEL.id)
  })
})
