import { CloseReason, KitExport, OpenBlocker, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { handleContractCall } from '../../../src/client/application/contract-call'
import { applyPageEvent } from '../../../src/client/application/page-event'
import { firstOpenBlocker, OpenPurpose, openConditionsFrom } from '../../../src/client/domain/open-blockers'
import { PAGE_EVENT_MAX_REPLIES } from '../../../src/protocol/page-event'
import { ToPage } from '../../../src/protocol/to-page'
import type { OwnedReply, StackEntry } from '../../../src/protocol/stack'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { FixtureOwner, OWNED_LIST_PANEL } from '../../fixtures/owned'
import { LIST_PANEL } from '../../fixtures/panels'
import { LOCAL_REPLIES, PAGE_REPLIES } from '../../fixtures/replies'
import { REMOVE_CONFIRM } from '../../fixtures/surfaces'
import { createReadyHarness, tracedOfKind, withToken, type UseCaseHarness } from './use-case-harness'

const TWO_BOOTS = 2

const LIST_ENTRY: StackEntry = { panelId: OWNED_LIST_PANEL.panel.id, owner: FixtureOwner.Whitelist }
const FUTURE_SEQ = 99

function sendEvent(harness: UseCaseHarness, appliedCommandSeq: number | null, entries: readonly StackEntry[], replies: readonly OwnedReply[]): void {
  const stack = appliedCommandSeq === null ? null : { appliedCommandSeq, entries }
  applyPageEvent(harness.context, withToken(harness, { event: { stack, replies } }))
}

function withListOpen(): UseCaseHarness {
  const harness = createReadyHarness()
  handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [LIST_PANEL])
  return harness
}

const backFromList: OwnedReply = { owner: FixtureOwner.Whitelist, reply: PAGE_REPLIES[ReplyKind.PanelClosed] }
const radialSelection: OwnedReply = { owner: FixtureOwner.Garage, reply: { ...PAGE_REPLIES[ReplyKind.RadialSelected], entryId: 'garage/main' } }

function blockerFor(harness: UseCaseHarness, caller: string): OpenBlocker | null {
  const situation = { pauseMenuActive: false, otherNuiFocus: false, screenFaded: false, driving: false, vehicleSpeedMetersPerSecond: 0, vehicleSpeedLimitKmh: 0, radialEntryCount: 1 }
  return firstOpenBlocker(openConditionsFrom(harness.store.read().gate, { ...situation, caller, now: harness.ports.clock.now() }), OpenPurpose.OwnerCall)
}

describe('applyPageEvent', () => {
  it('applies the stack snapshot to the registry, then delivers each reply localized, in order', () => {
    const harness = withListOpen()
    sendEvent(harness, 1, [], [{ owner: FixtureOwner.Whitelist, reply: PAGE_REPLIES[ReplyKind.ItemSelected] }, backFromList])
    expect(harness.store.read().registry.stack).toStrictEqual([])
    expect(harness.ports.replies.delivered.map((delivered) => delivered.reply)).toStrictEqual([LOCAL_REPLIES[ReplyKind.ItemSelected], LOCAL_REPLIES[ReplyKind.PanelClosed]])
    expect(tracedOfKind(harness, ReportKind.StackChanged).at(-1)?.data).toStrictEqual({ appliedCommandSeq: 1, panels: [] })
  })

  it('replays its own commands past the applied number', () => {
    const harness = withListOpen()
    sendEvent(harness, 0, [], [])
    expect(harness.store.read().registry.stack.map((registered) => registered.panel.id)).toStrictEqual([LIST_PANEL.id])
  })

  it('logs ReplyUndelivered when the owner export fails, and keeps delivering the others', () => {
    const harness = withListOpen()
    harness.ports.replies.refuseOwner(FixtureOwner.Whitelist)
    sendEvent(harness, 1, [], [backFromList, radialSelection])
    expect(tracedOfKind(harness, ReportKind.ReplyUndelivered).map((line) => line.data)).toStrictEqual([{ owner: FixtureOwner.Whitelist, reply: ReplyKind.PanelClosed }])
    expect(harness.ports.replies.delivered.map((delivered) => delivered.owner)).toStrictEqual([FixtureOwner.Garage])
  })

  it('treats an owner export that throws as undelivered', () => {
    const harness = withListOpen()
    const throwing = { ...harness.context, ports: { ...harness.ports, replies: { deliver: (): boolean => { throw new Error('stopped') } } } }
    applyPageEvent(throwing, withToken(harness, { event: { stack: { appliedCommandSeq: 1, entries: [] }, replies: [backFromList] } }))
    expect(tracedOfKind(harness, ReportKind.ReplyUndelivered)).toHaveLength(1)
  })

  it('delivers from a frozen copy of the list', () => {
    const harness = withListOpen()
    const replies = [backFromList]
    const delivered: OwnedReply[] = []
    const growing = { ...harness.context, ports: { ...harness.ports, replies: { deliver: (): boolean => { delivered.push(backFromList); replies.push(radialSelection); return true } } } }
    applyPageEvent(growing, withToken(harness, { event: { stack: { appliedCommandSeq: 1, entries: [] }, replies } }))
    expect(delivered).toHaveLength(1)
  })

  it('refuses more replies than one event can carry', () => {
    const harness = withListOpen()
    sendEvent(harness, 1, [], Array.from({ length: PAGE_EVENT_MAX_REPLIES + 1 }, () => backFromList))
    expect(harness.ports.replies.attempts).toStrictEqual([])
    expect(harness.store.read().registry.stack).toHaveLength(1)
  })

  it.each([null, {}, { event: null }])('ignores an unreadable body %j', (body) => {
    const harness = withListOpen()
    applyPageEvent(harness.context, body)
    expect(harness.store.read().registry.stack).toHaveLength(1)
    expect(harness.ports.console.printed).toHaveLength(1)
  })

  it('drops a reply whose fields do not match the contract', () => {
    const harness = withListOpen()
    sendEvent(harness, null, [], [{ owner: FixtureOwner.Whitelist, reply: { ...PAGE_REPLIES[ReplyKind.ItemSelected], itemId: 'Bad Item' } }])
    expect(harness.ports.replies.attempts).toStrictEqual([])
  })

  it('forces a Boot when the snapshot cannot be reconciled, and drops the event', () => {
    const harness = withListOpen()
    sendEvent(harness, FUTURE_SEQ, [], [backFromList])
    expect(harness.ports.nui.boots).toHaveLength(TWO_BOOTS)
    expect(harness.ports.replies.attempts).toStrictEqual([])
  })

  it('ignores a snapshot older than the last Boot without booting again', () => {
    const harness = withListOpen()
    sendEvent(harness, FUTURE_SEQ, [], [])
    handleContractCall(harness.context, KitExport.ClosePanel, FixtureOwner.Whitelist, [LIST_PANEL.id])
    sendEvent(harness, 0, [LIST_ENTRY], [])
    expect(harness.ports.nui.boots).toHaveLength(TWO_BOOTS)
  })

  it('settles a confirmation answered by the player', () => {
    const harness = createReadyHarness()
    handleContractCall(harness.context, KitExport.Confirm, FixtureOwner.Whitelist, [REMOVE_CONFIRM])
    sendEvent(harness, 1, [], [{ owner: FixtureOwner.Whitelist, reply: PAGE_REPLIES[ReplyKind.ConfirmAnswered] }])
    expect(harness.store.read().registry.confirms).toStrictEqual([])
  })
})

describe('gate transitions from the page', () => {
  it('starts the cooldown when Back closes the root panel', () => {
    const harness = withListOpen()
    sendEvent(harness, 1, [], [backFromList])
    expect(blockerFor(harness, FixtureOwner.Garage)).toBe(OpenBlocker.Cooldown)
  })

  it('starts the cooldown on CloseAll', () => {
    const harness = withListOpen()
    sendEvent(harness, 1, [], [{ owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: OWNED_LIST_PANEL.panel.id, reason: CloseReason.CloseAll } }])
    expect(blockerFor(harness, FixtureOwner.Garage)).toBe(OpenBlocker.Cooldown)
  })

  it('does not start the cooldown when Back only pops a sub-panel', () => {
    const harness = withListOpen()
    sendEvent(harness, 1, [LIST_ENTRY], [{ owner: FixtureOwner.Whitelist, reply: { ...PAGE_REPLIES[ReplyKind.PanelClosed], panelId: 'whitelist/add' } }])
    expect(blockerFor(harness, FixtureOwner.Garage)).toBeNull()
  })

  it('reserves the interface for the resource chosen in the radial', () => {
    const harness = withListOpen()
    sendEvent(harness, 1, [], [{ owner: FixtureOwner.Whitelist, reply: { ...PAGE_REPLIES[ReplyKind.PanelClosed], reason: CloseReason.RadialSelection } }, radialSelection])
    expect(blockerFor(harness, FixtureOwner.Whitelist)).toBe(OpenBlocker.Reserved)
    expect(blockerFor(harness, FixtureOwner.Garage)).toBeNull()
  })

  it('lets the chosen resource open right away', () => {
    const harness = createReadyHarness()
    sendEvent(harness, 0, [], [radialSelection])
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Garage, [LIST_PANEL])
    expect(harness.ports.nui.sentOfType(ToPage.OpenPanel)).toHaveLength(1)
    expect(harness.store.read().gate.reservedFor).toBeNull()
  })
})
