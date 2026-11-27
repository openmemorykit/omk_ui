import { CALL_BURST, CALL_DONE, KitExport } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { cleanupOwner } from '../../../src/client/application/cleanup-owner'
import { handleContractCall } from '../../../src/client/application/contract-call'
import { READY_INTERVAL_MS, receiveReady } from '../../../src/client/application/page-link'
import { reserveForSelectedOwner } from '../../../src/client/application/reservation'
import { ToPage } from '../../../src/protocol/to-page'
import { FixtureOwner } from '../../fixtures/owned'
import { LIST_PANEL } from '../../fixtures/panels'
import { GARAGE_RADIAL_ENTRY, HOLD_PROMPT, PLAIN_NOTIFICATION } from '../../fixtures/surfaces'
import { createHarness, createReadyHarness } from './use-case-harness'

describe('cleanupOwner', () => {
  it('removes everything the stopped resource held and tells the page with DropOwner', () => {
    const harness = createReadyHarness()
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Garage, [LIST_PANEL])
    handleContractCall(harness.context, KitExport.AddRadialEntry, FixtureOwner.Garage, [GARAGE_RADIAL_ENTRY])
    handleContractCall(harness.context, KitExport.ShowPrompt, FixtureOwner.Garage, [HOLD_PROMPT])
    cleanupOwner(harness.context, FixtureOwner.Garage)
    const { registry } = harness.store.read()
    expect([registry.stack, registry.radialEntries, registry.prompts]).toStrictEqual([[], [], []])
    expect(harness.ports.nui.sentOfType(ToPage.DropOwner)).toStrictEqual([{ type: ToPage.DropOwner, commandSeq: 2, owner: FixtureOwner.Garage }])
  })

  it('sends nothing for a resource that held nothing', () => {
    const harness = createReadyHarness()
    cleanupOwner(harness.context, FixtureOwner.Garage)
    expect(harness.ports.nui.sent).toStrictEqual([])
  })

  it.each(['', 'a/b', '__proto__'])('ignores the resource name %j', (name) => {
    const harness = createReadyHarness()
    const before = harness.store.read()
    cleanupOwner(harness.context, name)
    expect(harness.store.read()).toBe(before)
  })

  it('forgets its rate limit and drops its queued notifications', () => {
    const harness = createHarness()
    Array.from({ length: CALL_BURST }, () => handleContractCall(harness.context, KitExport.ClosePanel, FixtureOwner.Garage, [LIST_PANEL.id]))
    handleContractCall(harness.context, KitExport.Notify, FixtureOwner.Whitelist, [PLAIN_NOTIFICATION])
    cleanupOwner(harness.context, FixtureOwner.Garage)
    cleanupOwner(harness.context, FixtureOwner.Whitelist)
    expect(handleContractCall(harness.context, KitExport.ClosePanel, FixtureOwner.Garage, [LIST_PANEL.id])).toStrictEqual(CALL_DONE)
    expect(harness.store.read().link.queuedNotifications).toStrictEqual([])
  })

  it('ends the reservation held for it', () => {
    const harness = createReadyHarness()
    reserveForSelectedOwner(harness.context, FixtureOwner.Garage)
    cleanupOwner(harness.context, FixtureOwner.Garage)
    expect(harness.store.read().gate.reservedFor).toBeNull()
  })

  it('answers nothing for its panels when the page reloads later', () => {
    const harness = createReadyHarness()
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Garage, [LIST_PANEL])
    harness.ports.clock.advance(READY_INTERVAL_MS)
    receiveReady(harness.context)
    cleanupOwner(harness.context, FixtureOwner.Garage)
    harness.ports.clock.advance(READY_INTERVAL_MS)
    receiveReady(harness.context)
    expect(harness.ports.replies.attempts).toStrictEqual([])
  })
})
