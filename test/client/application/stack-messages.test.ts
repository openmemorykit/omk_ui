import { CloseReason, KitExport } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { handleContractCall } from '../../../src/client/application/contract-call'
import { sendStackCommand } from '../../../src/client/application/stack-messages'
import { closeAll, closePanel, dropOwner, EMPTY_REGISTRY, openPanel, StackCommandKind, type RegistryState } from '../../../src/client/domain/owner-registry'
import { UNAPPLIED_COMMANDS_MAX } from '../../../src/client/domain/registry-stack'
import { ToPage } from '../../../src/protocol/to-page'
import { FixtureOwner } from '../../fixtures/owned'
import { LIST_PANEL } from '../../fixtures/panels'
import { createHarness, createReadyHarness } from './use-case-harness'

const FORCED_BOOT_SEQ_STEP = 2

function openRepeatedly(times: number): RegistryState {
  return Array.from({ length: times }).reduce<RegistryState>((registry) => {
    const outcome = openPanel(registry, FixtureOwner.Whitelist, LIST_PANEL)
    return outcome.ok ? outcome.registry : registry
  }, EMPTY_REGISTRY)
}

describe('sendStackCommand', () => {
  it('sends nothing for a change without a command', () => {
    const harness = createReadyHarness()
    sendStackCommand(harness.context, harness.store.read().registry, null)
    expect(harness.ports.nui.sent).toStrictEqual([])
  })

  it('sends CloseAll with its number', () => {
    const harness = createReadyHarness()
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [LIST_PANEL])
    const opened = harness.store.read().registry
    const closed = closeAll(opened)
    harness.store.write({ ...harness.store.read(), registry: closed.registry })
    sendStackCommand(harness.context, opened, closed.command)
    expect(harness.ports.nui.sentOfType(ToPage.CloseAll)).toStrictEqual([{ type: ToPage.CloseAll, commandSeq: 2 }])
  })

  it('sends DropOwner for a resource that held something', () => {
    const harness = createReadyHarness()
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [LIST_PANEL])
    const opened = harness.store.read().registry
    const dropped = dropOwner(opened, FixtureOwner.Whitelist)
    harness.store.write({ ...harness.store.read(), registry: dropped.registry })
    sendStackCommand(harness.context, opened, dropped.command)
    expect(harness.ports.nui.sentOfType(ToPage.DropOwner)).toStrictEqual([{ type: ToPage.DropOwner, commandSeq: 2, owner: FixtureOwner.Whitelist }])
  })

  it('skips a ShowConfirm whose confirmation is no longer kept', () => {
    const harness = createReadyHarness()
    const registry = harness.store.read().registry
    sendStackCommand(harness.context, registry, { kind: StackCommandKind.ShowConfirm, owner: FixtureOwner.Whitelist, seq: 1 })
    expect(harness.ports.nui.sent).toStrictEqual([])
  })

  it('forces a Boot instead of a command once 256 commands wait for the page', () => {
    const harness = createReadyHarness()
    const full = openRepeatedly(UNAPPLIED_COMMANDS_MAX)
    const next = openPanel(full, FixtureOwner.Whitelist, LIST_PANEL)
    if (!next.ok) throw new Error('the fixture panel must open')
    harness.store.write({ ...harness.store.read(), registry: next.registry })
    sendStackCommand(harness.context, full, next.command)
    expect(harness.ports.nui.sentOfType(ToPage.OpenPanel)).toStrictEqual([])
    expect(harness.ports.nui.boots.map((boot) => boot.message.commandSeq)).toStrictEqual([0, UNAPPLIED_COMMANDS_MAX + FORCED_BOOT_SEQ_STEP])
    expect(harness.store.read().registry.unapplied).toStrictEqual([])
  })

  it('tells the owner of a panel it closed when the 257th command forces a Boot', () => {
    const harness = createReadyHarness()
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [LIST_PANEL])
    const opened = harness.store.read().registry
    const closed = closePanel(opened, FixtureOwner.Whitelist, LIST_PANEL.id)
    if (!closed.ok) throw new Error('the open panel must close')
    const full = { ...closed.registry, unapplied: openRepeatedly(UNAPPLIED_COMMANDS_MAX).unapplied }
    harness.store.write({ ...harness.store.read(), registry: full })
    sendStackCommand(harness.context, full, closed.command)
    expect(harness.ports.replies.attempts.map((attempt) => attempt.reply)).toMatchObject([{ panelId: LIST_PANEL.id, reason: CloseReason.ClosedByOwner }])
  })

  it('answers locally with CloseAll for panels closed by a CloseAll before the page is ready', () => {
    const harness = createHarness()
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [LIST_PANEL])
    const opened = harness.store.read().registry
    const closed = closeAll(opened)
    harness.store.write({ ...harness.store.read(), registry: closed.registry })
    sendStackCommand(harness.context, opened, closed.command)
    expect(harness.ports.replies.delivered.map((delivered) => delivered.reply)).toMatchObject([{ panelId: LIST_PANEL.id, reason: CloseReason.CloseAll }])
  })

  it('answers nothing locally for a dropped owner', () => {
    const harness = createHarness()
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [LIST_PANEL])
    const opened = harness.store.read().registry
    const dropped = dropOwner(opened, FixtureOwner.Whitelist)
    harness.store.write({ ...harness.store.read(), registry: dropped.registry })
    sendStackCommand(harness.context, opened, dropped.command)
    expect(harness.ports.replies.attempts).toStrictEqual([])
  })
})
