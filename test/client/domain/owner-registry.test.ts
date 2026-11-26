import { describe, expect, it } from 'vitest'
import { ContractErrorCode, STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import {
  addRadialEntry,
  checkFormOwner,
  closePanel,
  EMPTY_REGISTRY,
  openPanel,
  pushPanel,
  radialOrder,
  settleConfirm,
  showConfirm,
  showPrompt,
  StackCommandKind,
  updatePanel,
} from '../../../src/client/domain/owner-registry'
import type { RegistryOutcome, RegistryState } from '../../../src/client/domain/owner-registry'
import { LOCAL_ID_MAX_LENGTH } from '../../../src/protocol/namespaced-id'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_LIST_PANEL } from '../../fixtures/owned'
import { ADD_PANEL, LIST_PANEL } from '../../fixtures/panels'
import { HOLD_PROMPT, REMOVE_CONFIRM, WHITELIST_RADIAL_ENTRY } from '../../fixtures/surfaces'
import { accepted, commandOf, HOSTILE_OWNERS, panelAt, refusal, registryAfter } from './registry-helpers'

const { Whitelist, Garage } = FixtureOwner

const withList = registryAfter(openPanel(EMPTY_REGISTRY, Whitelist, LIST_PANEL))
const withListAndAdd = registryAfter(pushPanel(withList, Whitelist, ADD_PANEL, LIST_PANEL.id))

function stackOfDepth(depth: number): RegistryState {
  return Array.from({ length: depth - 1 }, (_unused, level) => level + 1).reduce(
    (registry, level) => registryAfter(pushPanel(registry, Whitelist, panelAt(level), panelAt(level - 1).id)),
    registryAfter(openPanel(EMPTY_REGISTRY, Whitelist, panelAt(0))),
  )
}

describe('openPanel', () => {
  it('registers the local panel and sends the namespaced one with the first command', () => {
    const outcome = accepted(openPanel(EMPTY_REGISTRY, Whitelist, LIST_PANEL))
    expect(outcome.registry.stack).toStrictEqual([{ owner: Whitelist, panel: LIST_PANEL }])
    expect(outcome.command).toStrictEqual({ kind: StackCommandKind.Open, seq: 1, owner: Whitelist, panel: OWNED_LIST_PANEL, panelId: null })
    expect(outcome.registry.commandSeq).toBe(1)
    expect(outcome.registry.unapplied).toStrictEqual([outcome.command])
  })

  it('replaces the stack of the same owner', () => {
    expect(registryAfter(openPanel(withListAndAdd, Whitelist, ADD_PANEL)).stack).toStrictEqual([{ owner: Whitelist, panel: ADD_PANEL }])
  })

  it('is refused while the stack holds a panel of another owner', () => {
    expect(refusal(openPanel(withList, Garage, LIST_PANEL)).code).toBe(ContractErrorCode.Occupied)
  })

  it('is refused while another owner waits on a confirmation', () => {
    const confirming = registryAfter(showConfirm(EMPTY_REGISTRY, Garage, REMOVE_CONFIRM))
    expect(refusal(openPanel(confirming, Whitelist, LIST_PANEL)).code).toBe(ContractErrorCode.Occupied)
  })

  it('lets two owners use the same local id one after the other', () => {
    const closed = registryAfter(closePanel(withList, Whitelist, LIST_PANEL.id))
    const garage = accepted(openPanel(closed, Garage, LIST_PANEL))
    expect(garage.registry.stack).toStrictEqual([{ owner: Garage, panel: LIST_PANEL }])
    expect(garage.command?.panel?.panel.id).toBe('garage/list')
  })
})

describe('pushPanel', () => {
  it('stacks a child on the top panel and names the namespaced parent', () => {
    const command = commandOf(pushPanel(withList, Whitelist, ADD_PANEL, LIST_PANEL.id))
    expect(command).toStrictEqual({ kind: StackCommandKind.Push, seq: 2, owner: Whitelist, panel: OWNED_ADD_PANEL, panelId: 'whitelist/list' })
    expect(withListAndAdd.stack).toStrictEqual([{ owner: Whitelist, panel: LIST_PANEL }, { owner: Whitelist, panel: ADD_PANEL }])
  })

  it.each([
    ['the top panel belongs to another owner', withList, Garage, LIST_PANEL.id],
    ['the parent is not the top panel', withListAndAdd, Whitelist, LIST_PANEL.id],
    ['the stack is empty', EMPTY_REGISTRY, Whitelist, LIST_PANEL.id],
  ])('is refused with NotOwner when %s', (_case, registry, owner, parentId) => {
    expect(refusal(pushPanel(registry, owner, panelAt(1), parentId)).code).toBe(ContractErrorCode.NotOwner)
  })

  it('is refused with AlreadyOpen when the id is in the stack', () => {
    expect(refusal(pushPanel(withListAndAdd, Whitelist, LIST_PANEL, ADD_PANEL.id)).code).toBe(ContractErrorCode.AlreadyOpen)
  })

  it('is refused with StackFull on the ninth level', () => {
    const full = stackOfDepth(STACK_MAX_DEPTH)
    expect(full.stack).toHaveLength(STACK_MAX_DEPTH)
    const ninth = pushPanel(full, Whitelist, panelAt(STACK_MAX_DEPTH), panelAt(STACK_MAX_DEPTH - 1).id)
    expect(refusal(ninth).code).toBe(ContractErrorCode.StackFull)
  })
})

describe('updatePanel', () => {
  it('replaces the descriptor in place without a stack command', () => {
    const renamed = { ...LIST_PANEL, title: 'Renamed' }
    const outcome = accepted(updatePanel(withListAndAdd, Whitelist, renamed))
    expect(outcome.command).toBeNull()
    expect(outcome.registry.stack.map(({ panel }) => panel)).toStrictEqual([renamed, ADD_PANEL])
    expect(outcome.registry.unapplied).toBe(withListAndAdd.unapplied)
  })

  it.each([
    ['an id the owner has not opened', Whitelist],
    ['the same local id opened by another owner', Garage],
  ])('refuses %s as an unknown panel', (_case, owner) => {
    expect(refusal(updatePanel(withList, owner, owner === Whitelist ? ADD_PANEL : LIST_PANEL)).code).toBe(ContractErrorCode.UnknownPanel)
  })
})

describe('closePanel', () => {
  it('closes the panel and the panels above it with one command', () => {
    const outcome = accepted(closePanel(withListAndAdd, Whitelist, LIST_PANEL.id))
    expect(outcome.command).toStrictEqual({ kind: StackCommandKind.Close, seq: 3, owner: Whitelist, panel: null, panelId: 'whitelist/list' })
    expect(outcome.registry.stack).toStrictEqual([])
  })

  it('accepts a panel the player already closed, without a command', () => {
    const outcome = accepted(closePanel(withList, Whitelist, ADD_PANEL.id))
    expect(outcome).toStrictEqual({ ok: true, registry: withList, command: null })
  })

  it('sends one close per open, never a second for the same panel', () => {
    const closed = registryAfter(closePanel(withList, Whitelist, LIST_PANEL.id))
    expect(accepted(closePanel(closed, Whitelist, LIST_PANEL.id)).command).toBeNull()
    expect(accepted(closePanel(withList, Garage, LIST_PANEL.id)).command).toBeNull()
  })

  it('stops form checks and updates on the closed panel', () => {
    const closed = registryAfter(closePanel(withListAndAdd, Whitelist, ADD_PANEL.id))
    expect(checkFormOwner(closed, Whitelist, ADD_PANEL.id)?.code).toBe(ContractErrorCode.UnknownPanel)
    expect(refusal(updatePanel(closed, Whitelist, ADD_PANEL)).code).toBe(ContractErrorCode.UnknownPanel)
  })
})

describe('checkFormOwner', () => {
  it('accepts a form of the owner', () => {
    expect(checkFormOwner(withListAndAdd, Whitelist, ADD_PANEL.id)).toBeNull()
  })

  it.each([
    ['a menu', Whitelist, LIST_PANEL.id],
    ['an absent panel', Whitelist, 'missing'],
    ['the form of another owner', Garage, ADD_PANEL.id],
  ])('refuses %s as an unknown panel', (_case, owner, panelId) => {
    expect(checkFormOwner(withListAndAdd, owner, panelId)).toStrictEqual({ path: '', code: ContractErrorCode.UnknownPanel })
  })
})

describe('confirmations', () => {
  it('always carry a command number', () => {
    const command = commandOf(showConfirm(withList, Whitelist, REMOVE_CONFIRM))
    expect(command).toStrictEqual({ kind: StackCommandKind.ShowConfirm, seq: 2, owner: Whitelist, panel: null, panelId: null })
  })

  it('are refused while the stack holds a panel of another owner', () => {
    expect(refusal(showConfirm(withList, Garage, REMOVE_CONFIRM)).code).toBe(ContractErrorCode.Occupied)
  })

  it('allow one pending confirmation per owner until it is settled', () => {
    const confirming = registryAfter(showConfirm(EMPTY_REGISTRY, Whitelist, REMOVE_CONFIRM))
    expect(confirming.confirms).toStrictEqual([{ owner: Whitelist, confirm: REMOVE_CONFIRM }])
    expect(refusal(showConfirm(confirming, Whitelist, { ...REMOVE_CONFIRM, id: 'other' })).code).toBe(ContractErrorCode.QuotaExceeded)
    const settled = settleConfirm(confirming, Whitelist, REMOVE_CONFIRM.id)
    expect(settled.confirms).toStrictEqual([])
    expect(showConfirm(settled, Whitelist, REMOVE_CONFIRM).ok).toBe(true)
  })

  it('settle only the confirmation of the caller', () => {
    const confirming = registryAfter(showConfirm(EMPTY_REGISTRY, Whitelist, REMOVE_CONFIRM))
    expect(settleConfirm(confirming, Garage, REMOVE_CONFIRM.id)).toBe(confirming)
  })
})

describe('owner checks', () => {
  const entryPoints: readonly (readonly [string, (registry: RegistryState, owner: string) => RegistryOutcome])[] = [
    ['addRadialEntry', (registry, owner) => addRadialEntry(registry, owner, WHITELIST_RADIAL_ENTRY)],
    ['openPanel', (registry, owner) => openPanel(registry, owner, LIST_PANEL)],
    ['pushPanel', (registry, owner) => pushPanel(registry, owner, ADD_PANEL, LIST_PANEL.id)],
    ['showConfirm', (registry, owner) => showConfirm(registry, owner, REMOVE_CONFIRM)],
    ['showPrompt', (registry, owner) => showPrompt(registry, owner, HOLD_PROMPT)],
  ]
  const cases = entryPoints.flatMap(([name, call]) => HOSTILE_OWNERS.map((owner) => [name, owner, call] as const))

  it.each(cases)('%s refuses the owner %s with BadIdentifier and changes nothing', (_name, owner, call) => {
    const registry = registryAfter(addRadialEntry(EMPTY_REGISTRY, Garage, WHITELIST_RADIAL_ENTRY))
    const outcome = call(registry, owner)
    expect(refusal(outcome)).toStrictEqual({ path: '', code: ContractErrorCode.BadIdentifier })
    expect(() => radialOrder(registry)).not.toThrow()
  })

  it.each([
    ['openPanel', () => openPanel(EMPTY_REGISTRY, Whitelist, { ...LIST_PANEL, id: 'Bad/Id' })],
    ['pushPanel', () => pushPanel(withList, Whitelist, { ...ADD_PANEL, id: '__proto__' }, LIST_PANEL.id)],
    ['showConfirm', () => showConfirm(EMPTY_REGISTRY, Whitelist, { ...REMOVE_CONFIRM, id: 'x'.repeat(LOCAL_ID_MAX_LENGTH + 1) })],
    ['showPrompt', () => showPrompt(EMPTY_REGISTRY, Whitelist, { ...HOLD_PROMPT, id: '' })],
    ['addRadialEntry', () => addRadialEntry(EMPTY_REGISTRY, Whitelist, { ...WHITELIST_RADIAL_ENTRY, id: 'constructor' })],
  ])('%s refuses a local id that cannot be namespaced, without throwing', (_name, call) => {
    expect(refusal(call())).toStrictEqual({ path: 'id', code: ContractErrorCode.BadIdentifier })
  })
})
