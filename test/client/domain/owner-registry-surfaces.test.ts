import { describe, expect, it } from 'vitest'
import { ContractErrorCode, PROMPTS_PER_OWNER, RADIAL_ENTRIES_PER_OWNER, RADIAL_MAX_SECTORS } from '@openmemorykit/ui/contract'
import type { Prompt, RadialEntry } from '@openmemorykit/ui/contract'
import {
  addRadialEntry,
  dropOwner,
  EMPTY_REGISTRY,
  hidePrompt,
  openPanel,
  radialOrder,
  removeRadialEntry,
  showConfirm,
  showPrompt,
  StackCommandKind,
  visiblePrompt,
} from '../../../src/client/domain/owner-registry'
import type { RegistryState } from '../../../src/client/domain/owner-registry'
import { FixtureOwner, OWNED_GARAGE_RADIAL_ENTRY, OWNED_WHITELIST_RADIAL_ENTRY } from '../../fixtures/owned'
import { LIST_PANEL } from '../../fixtures/panels'
import { GARAGE_RADIAL_ENTRY, HOLD_PROMPT, PRESS_PROMPT, REMOVE_CONFIRM, WHITELIST_RADIAL_ENTRY } from '../../fixtures/surfaces'
import { accepted, refusal, registryAfter } from './registry-helpers'

const { Whitelist, Garage } = FixtureOwner

const entryNamed = (id: string): RadialEntry => ({ ...GARAGE_RADIAL_ENTRY, id })
const promptNamed = (id: string): Prompt => ({ ...PRESS_PROMPT, id })

function withEntries(additions: readonly (readonly [string, RadialEntry])[]): RegistryState {
  return additions.reduce((registry, [owner, entry]) => registryAfter(addRadialEntry(registry, owner, entry)), EMPTY_REGISTRY)
}

function withPrompts(owner: string, count: number): RegistryState {
  return Array.from({ length: count }, (_unused, index) => promptNamed(`prompt-${index}`)).reduce(
    (registry, prompt) => registryAfter(showPrompt(registry, owner, prompt)),
    EMPTY_REGISTRY,
  )
}

describe('radial entries', () => {
  it('keep the same local id of two owners apart', () => {
    const registry = withEntries([[Whitelist, WHITELIST_RADIAL_ENTRY], [Garage, GARAGE_RADIAL_ENTRY]])
    expect(radialOrder(registry)).toStrictEqual([OWNED_GARAGE_RADIAL_ENTRY, OWNED_WHITELIST_RADIAL_ENTRY])
    const removed = registryAfter(removeRadialEntry(registry, Garage, GARAGE_RADIAL_ENTRY.id))
    expect(radialOrder(removed)).toStrictEqual([OWNED_WHITELIST_RADIAL_ENTRY])
  })

  it('are ordered by owner, then by id, whatever the order of addition', () => {
    const whitelistZeta = [Whitelist, entryNamed('zeta')] as const
    const garageBeta = [Garage, entryNamed('beta')] as const
    const whitelistAlpha = [Whitelist, entryNamed('alpha')] as const
    const garageAlpha = [Garage, entryNamed('alpha')] as const
    const orders = [
      [whitelistZeta, garageBeta, whitelistAlpha, garageAlpha],
      [garageAlpha, whitelistAlpha, garageBeta, whitelistZeta],
      [whitelistAlpha, garageBeta, garageAlpha, whitelistZeta],
    ]
    orders.forEach((order) => {
      expect(radialOrder(withEntries(order)).map(({ entry }) => entry.id)).toStrictEqual(['garage/alpha', 'garage/beta', 'whitelist/alpha', 'whitelist/zeta'])
    })
  })

  it('replace an entry added again under the same id without using the quota', () => {
    const renamed = { ...WHITELIST_RADIAL_ENTRY, label: 'Renamed' }
    const registry = withEntries([[Whitelist, WHITELIST_RADIAL_ENTRY], [Whitelist, entryNamed('other')], [Whitelist, renamed]])
    expect(registry.radialEntries).toStrictEqual([{ owner: Whitelist, entry: renamed }, { owner: Whitelist, entry: entryNamed('other') }])
  })

  it('refuse a third entry of one owner with QuotaExceeded', () => {
    const registry = withEntries(Array.from({ length: RADIAL_ENTRIES_PER_OWNER }, (_unused, index) => [Whitelist, entryNamed(`entry-${index}`)] as const))
    expect(refusal(addRadialEntry(registry, Whitelist, entryNamed('third'))).code).toBe(ContractErrorCode.QuotaExceeded)
  })

  it('refuse a ninth sector with RadialFull naming the present owners, sorted', () => {
    const owners = ['delta', 'alpha', 'charlie', 'bravo']
    const additions = owners.flatMap((owner) => Array.from({ length: RADIAL_ENTRIES_PER_OWNER }, (_unused, index) => [owner, entryNamed(`entry-${index}`)] as const))
    const full = withEntries(additions)
    expect(full.radialEntries).toHaveLength(RADIAL_MAX_SECTORS)
    expect(refusal(addRadialEntry(full, Whitelist, WHITELIST_RADIAL_ENTRY))).toStrictEqual({
      path: '',
      code: ContractErrorCode.RadialFull,
      detail: 'alpha,bravo,charlie,delta',
    })
  })

  it('ignore the removal of an unknown entry', () => {
    const registry = withEntries([[Whitelist, WHITELIST_RADIAL_ENTRY]])
    expect(removeRadialEntry(registry, Garage, WHITELIST_RADIAL_ENTRY.id)).toStrictEqual({ ok: true, registry, command: null })
    expect(removeRadialEntry(registry, Whitelist, 'missing')).toStrictEqual({ ok: true, registry, command: null })
  })
})

describe('prompts', () => {
  it('show the last prompt shown', () => {
    const registry = registryAfter(showPrompt(registryAfter(showPrompt(EMPTY_REGISTRY, Garage, HOLD_PROMPT)), Whitelist, PRESS_PROMPT))
    expect(visiblePrompt(registry)).toStrictEqual({ owner: Whitelist, prompt: PRESS_PROMPT })
    expect(visiblePrompt(registryAfter(hidePrompt(registry, Whitelist, PRESS_PROMPT.id)))).toStrictEqual({ owner: Garage, prompt: HOLD_PROMPT })
    expect(visiblePrompt(EMPTY_REGISTRY)).toBeNull()
  })

  it('move a prompt shown again to the top without using the quota', () => {
    const registry = withPrompts(Garage, PROMPTS_PER_OWNER)
    const again = registryAfter(showPrompt(registry, Garage, promptNamed('prompt-0')))
    expect(again.prompts).toHaveLength(PROMPTS_PER_OWNER)
    expect(visiblePrompt(again)?.prompt.id).toBe('prompt-0')
  })

  it('refuse a fifth prompt of one owner with QuotaExceeded', () => {
    const registry = withPrompts(Garage, PROMPTS_PER_OWNER)
    expect(refusal(showPrompt(registry, Garage, HOLD_PROMPT)).code).toBe(ContractErrorCode.QuotaExceeded)
    expect(showPrompt(registry, Whitelist, HOLD_PROMPT).ok).toBe(true)
  })

  it('keep the same local id of two owners apart', () => {
    const registry = registryAfter(showPrompt(registryAfter(showPrompt(EMPTY_REGISTRY, Garage, HOLD_PROMPT)), Whitelist, HOLD_PROMPT))
    expect(registryAfter(hidePrompt(registry, Garage, HOLD_PROMPT.id)).prompts).toStrictEqual([{ owner: Whitelist, prompt: HOLD_PROMPT }])
  })

  it('ignore hiding an unknown prompt', () => {
    const registry = withPrompts(Garage, 1)
    expect(hidePrompt(registry, Whitelist, 'prompt-0')).toStrictEqual({ ok: true, registry, command: null })
  })

  it('never carry a stack command', () => {
    expect(accepted(showPrompt(EMPTY_REGISTRY, Garage, HOLD_PROMPT)).command).toBeNull()
  })
})

describe('dropOwner', () => {
  it('removes everything the owner holds and keeps the others', () => {
    const steps = [
      (registry: RegistryState) => addRadialEntry(registry, Whitelist, WHITELIST_RADIAL_ENTRY),
      (registry: RegistryState) => addRadialEntry(registry, Garage, GARAGE_RADIAL_ENTRY),
      (registry: RegistryState) => openPanel(registry, Whitelist, LIST_PANEL),
      (registry: RegistryState) => showConfirm(registry, Whitelist, REMOVE_CONFIRM),
      (registry: RegistryState) => showPrompt(registry, Whitelist, PRESS_PROMPT),
      (registry: RegistryState) => showPrompt(registry, Garage, HOLD_PROMPT),
    ]
    const registry = steps.reduce((current, step) => registryAfter(step(current)), EMPTY_REGISTRY)
    const dropped = dropOwner(registry, Whitelist)
    expect(dropped.command).toStrictEqual({ kind: StackCommandKind.DropOwner, seq: 3, owner: Whitelist, panel: null, panelId: null })
    expect(dropped.registry).toStrictEqual({
      radialEntries: [{ owner: Garage, entry: GARAGE_RADIAL_ENTRY }],
      stack: [],
      confirms: [],
      prompts: [{ owner: Garage, prompt: HOLD_PROMPT }],
      commandSeq: 3,
      unapplied: [...registry.unapplied, dropped.command],
    })
  })

  it('frees the screen for another owner', () => {
    const occupied = registryAfter(openPanel(EMPTY_REGISTRY, Whitelist, LIST_PANEL))
    expect(openPanel(dropOwner(occupied, Whitelist).registry, Garage, LIST_PANEL).ok).toBe(true)
  })
})
