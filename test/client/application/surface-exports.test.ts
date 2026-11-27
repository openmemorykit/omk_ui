import { CALL_DONE, CallStatus, ContractErrorCode, KitExport, RADIAL_ENTRIES_PER_OWNER, type CallResult } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { cleanupOwner } from '../../../src/client/application/cleanup-owner'
import { handleContractCall } from '../../../src/client/application/contract-call'
import { interactPress, trackPromptFrame } from '../../../src/client/application/track-prompts'
import { HoldSource, PromptPhase, SHOWN_PROMPT, type PromptHold } from '../../../src/client/domain/hold-prompt'
import { ToPage } from '../../../src/protocol/to-page'
import { FixtureOwner, OWNED_GARAGE_RADIAL_ENTRY, OWNED_HOLD_PROMPT, OWNED_PLAIN_NOTIFICATION, OWNED_WHITELIST_RADIAL_ENTRY } from '../../fixtures/owned'
import { GARAGE_RADIAL_ENTRY, HOLD_PROMPT, HOLD_PROMPT_MS, PLAIN_NOTIFICATION, WHITELIST_RADIAL_ENTRY } from '../../fixtures/surfaces'
import { createHarness, createReadyHarness, type UseCaseHarness } from './use-case-harness'

const EXTRA_ENTRY_IDS = ['second', 'third'] as const

function holdingOn(harness: UseCaseHarness, owner: string): PromptHold {
  const hold: PromptHold = { phase: PromptPhase.Holding, startedAt: harness.ports.clock.now(), held: { owner, promptId: HOLD_PROMPT.id, source: HoldSource.Command } }
  harness.store.write({ ...harness.store.read(), prompt: hold })
  return hold
}

function call(harness: UseCaseHarness, name: KitExport, owner: string, ...args: readonly unknown[]): CallResult {
  return handleContractCall(harness.context, name, owner, args)
}

describe('radial entry exports', () => {
  it('sends the sorted radial entries after each registration', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.AddRadialEntry, FixtureOwner.Whitelist, WHITELIST_RADIAL_ENTRY)
    call(harness, KitExport.AddRadialEntry, FixtureOwner.Garage, GARAGE_RADIAL_ENTRY)
    expect(harness.ports.nui.sentOfType(ToPage.RadialEntries).at(-1)?.entries).toStrictEqual([OWNED_GARAGE_RADIAL_ENTRY, OWNED_WHITELIST_RADIAL_ENTRY])
  })

  it('refuses a third entry of the same resource with QuotaExceeded', () => {
    const harness = createReadyHarness()
    EXTRA_ENTRY_IDS.slice(0, RADIAL_ENTRIES_PER_OWNER).forEach((id) => call(harness, KitExport.AddRadialEntry, FixtureOwner.Garage, { ...GARAGE_RADIAL_ENTRY, id }))
    const result = call(harness, KitExport.AddRadialEntry, FixtureOwner.Garage, GARAGE_RADIAL_ENTRY)
    expect(result.status === CallStatus.Refused ? result.errors[0]?.code : undefined).toBe(ContractErrorCode.QuotaExceeded)
  })

  it('removes its own entry and sends the new list, and stays silent when nothing changed', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.AddRadialEntry, FixtureOwner.Garage, GARAGE_RADIAL_ENTRY)
    expect(call(harness, KitExport.RemoveRadialEntry, FixtureOwner.Whitelist, GARAGE_RADIAL_ENTRY.id)).toStrictEqual(CALL_DONE)
    expect(harness.ports.nui.sentOfType(ToPage.RadialEntries)).toHaveLength(1)
    call(harness, KitExport.RemoveRadialEntry, FixtureOwner.Garage, GARAGE_RADIAL_ENTRY.id)
    expect(harness.ports.nui.sentOfType(ToPage.RadialEntries).at(-1)?.entries).toStrictEqual([])
  })

  it('keeps entries for the Boot while the page is not ready', () => {
    const harness = createHarness()
    expect(call(harness, KitExport.AddRadialEntry, FixtureOwner.Garage, GARAGE_RADIAL_ENTRY)).toStrictEqual(CALL_DONE)
    expect(harness.ports.nui.sent).toStrictEqual([])
  })
})

describe('prompt exports', () => {
  it('shows a namespaced prompt and starts the pump', () => {
    const harness = createReadyHarness()
    expect(call(harness, KitExport.ShowPrompt, FixtureOwner.Garage, HOLD_PROMPT)).toStrictEqual(CALL_DONE)
    expect(harness.ports.nui.sentOfType(ToPage.ShowPrompt)).toStrictEqual([{ type: ToPage.ShowPrompt, prompt: OWNED_HOLD_PROMPT }])
    expect(harness.ports.pump.isRunning()).toBe(true)
  })

  it('hides its own prompt and stops the pump nothing else needs', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.ShowPrompt, FixtureOwner.Garage, HOLD_PROMPT)
    expect(call(harness, KitExport.HidePrompt, FixtureOwner.Garage, HOLD_PROMPT.id)).toStrictEqual(CALL_DONE)
    expect(harness.ports.nui.sentOfType(ToPage.HidePrompt)).toStrictEqual([{ type: ToPage.HidePrompt, promptId: OWNED_HOLD_PROMPT.prompt.id }])
    expect(harness.ports.pump.isRunning()).toBe(false)
  })

  it('ignores hiding a prompt it does not own', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.ShowPrompt, FixtureOwner.Garage, HOLD_PROMPT)
    expect(call(harness, KitExport.HidePrompt, FixtureOwner.Whitelist, HOLD_PROMPT.id)).toStrictEqual(CALL_DONE)
    expect(harness.ports.nui.sentOfType(ToPage.HidePrompt)).toStrictEqual([])
    expect(harness.ports.pump.isRunning()).toBe(true)
  })
})

describe('prompt display after a change', () => {
  it('shows the older prompt again when the visible one is hidden', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.ShowPrompt, FixtureOwner.Garage, HOLD_PROMPT)
    call(harness, KitExport.ShowPrompt, FixtureOwner.Whitelist, HOLD_PROMPT)
    call(harness, KitExport.HidePrompt, FixtureOwner.Whitelist, HOLD_PROMPT.id)
    expect(harness.ports.nui.sentOfType(ToPage.ShowPrompt).at(-1)).toStrictEqual({ type: ToPage.ShowPrompt, prompt: OWNED_HOLD_PROMPT })
    expect(harness.ports.nui.sentOfType(ToPage.HidePrompt)).toStrictEqual([])
  })

  it('sends nothing when an older prompt is hidden under the visible one', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.ShowPrompt, FixtureOwner.Garage, HOLD_PROMPT)
    call(harness, KitExport.ShowPrompt, FixtureOwner.Whitelist, HOLD_PROMPT)
    const sentBefore = harness.ports.nui.sent.length
    call(harness, KitExport.HidePrompt, FixtureOwner.Garage, HOLD_PROMPT.id)
    expect(harness.ports.nui.sent).toHaveLength(sentBefore)
  })

  it('keeps a hold on the visible prompt when an older prompt is hidden beneath it', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.ShowPrompt, FixtureOwner.Garage, HOLD_PROMPT)
    call(harness, KitExport.ShowPrompt, FixtureOwner.Whitelist, HOLD_PROMPT)
    const hold = holdingOn(harness, FixtureOwner.Whitelist)
    call(harness, KitExport.HidePrompt, FixtureOwner.Garage, HOLD_PROMPT.id)
    expect(harness.store.read().prompt).toBe(hold)
  })

  it('keeps a hold on a prompt its owner shows again', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.ShowPrompt, FixtureOwner.Garage, HOLD_PROMPT)
    const hold = holdingOn(harness, FixtureOwner.Garage)
    call(harness, KitExport.ShowPrompt, FixtureOwner.Garage, HOLD_PROMPT)
    expect(harness.store.read().prompt).toBe(hold)
  })

  it('cancels at once a hold covered by another prompt', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.ShowPrompt, FixtureOwner.Garage, HOLD_PROMPT)
    holdingOn(harness, FixtureOwner.Garage)
    call(harness, KitExport.ShowPrompt, FixtureOwner.Whitelist, HOLD_PROMPT)
    expect(harness.store.read().prompt).toBe(SHOWN_PROMPT)
  })

  it('does not complete a hold that its owner hid and showed again while the player had let go', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.ShowPrompt, FixtureOwner.Garage, HOLD_PROMPT)
    interactPress(harness.ports, harness.store)
    call(harness, KitExport.HidePrompt, FixtureOwner.Garage, HOLD_PROMPT.id)
    call(harness, KitExport.ShowPrompt, FixtureOwner.Garage, HOLD_PROMPT)
    harness.ports.clock.advance(HOLD_PROMPT_MS)
    if (harness.ports.pump.isRunning()) trackPromptFrame(harness.ports, harness.store)
    expect(harness.ports.replies.delivered).toStrictEqual([])
    expect(harness.store.read().prompt).toBe(SHOWN_PROMPT)
  })

  it('shows the prompt left by a stopped resource', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.ShowPrompt, FixtureOwner.Garage, HOLD_PROMPT)
    call(harness, KitExport.ShowPrompt, FixtureOwner.Whitelist, HOLD_PROMPT)
    cleanupOwner(harness.context, FixtureOwner.Whitelist)
    expect(harness.ports.nui.sent.at(-1)).toStrictEqual({ type: ToPage.ShowPrompt, prompt: OWNED_HOLD_PROMPT })
  })

  it('keeps the prompt changes for the Boot while the page is not ready', () => {
    const harness = createHarness()
    call(harness, KitExport.ShowPrompt, FixtureOwner.Garage, HOLD_PROMPT)
    call(harness, KitExport.HidePrompt, FixtureOwner.Garage, HOLD_PROMPT.id)
    expect(harness.ports.nui.sent).toStrictEqual([])
  })
})

describe('notify export', () => {
  it('sends a notification to a ready page', () => {
    const harness = createReadyHarness()
    expect(call(harness, KitExport.Notify, FixtureOwner.Garage, PLAIN_NOTIFICATION)).toStrictEqual(CALL_DONE)
    expect(harness.ports.nui.sentOfType(ToPage.Notify)).toStrictEqual([{ type: ToPage.Notify, notification: OWNED_PLAIN_NOTIFICATION }])
  })
})
