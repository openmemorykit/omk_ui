import { CALL_DONE, CallStatus, ContractErrorCode, FormOutcome, KitExport, OpenBlocker, type CallResult } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { handleContractCall } from '../../../src/client/application/contract-call'
import { reserveForSelectedOwner, RESERVATION_MS } from '../../../src/client/application/reservation'
import { closedByPlayer, CLOSE_COOLDOWN_MS } from '../../../src/client/domain/open-blockers'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../src/protocol/to-page'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { FixtureOwner } from '../../fixtures/owned'
import { ADD_PANEL, LIST_PANEL } from '../../fixtures/panels'
import { FIRST_SUBMISSION_ID } from '../../fixtures/replies'
import { REMOVE_CONFIRM } from '../../fixtures/surfaces'
import { createReadyHarness, tracedOfKind, type UseCaseHarness } from './use-case-harness'

const SECOND_COMMAND = 2

const FAST_SPEED_METERS_PER_SECOND = 20
const SLOW_SPEED_METERS_PER_SECOND = 1
const RENAMED_TITLE = 'Renamed'
const ACCEPTED_RESULT = { outcome: FormOutcome.Accepted }

function refusal(result: CallResult): { readonly code?: ContractErrorCode; readonly detail?: string } | undefined {
  return result.status === CallStatus.Refused ? result.errors[0] : undefined
}

function call(harness: UseCaseHarness, name: KitExport, owner: string, ...args: readonly unknown[]): CallResult {
  return handleContractCall(harness.context, name, owner, args)
}

function withListOpen(): UseCaseHarness {
  const harness = createReadyHarness()
  call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, LIST_PANEL)
  return harness
}

describe('openPanel and confirm blockers', () => {
  it.each([
    ['the pause menu is open', { pauseMenuActive: true }, OpenBlocker.PauseMenu],
    ['the screen is faded', { screenFaded: true }, OpenBlocker.ScreenFaded],
    ['another resource holds the NUI focus', { nuiFocused: true }, OpenBlocker.OtherNuiFocus],
    ['the player drives too fast', { drivenVehicleSpeed: FAST_SPEED_METERS_PER_SECOND }, OpenBlocker.VehicleMoving],
  ])('refuses openPanel and confirm when %s, and logs the reason', (_case, situation, blocker) => {
    const harness = createReadyHarness()
    harness.ports.game.setSituation(situation)
    expect(refusal(call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, LIST_PANEL))).toStrictEqual({ path: '', code: ContractErrorCode.OpenBlocked, detail: blocker })
    expect(refusal(call(harness, KitExport.Confirm, FixtureOwner.Whitelist, REMOVE_CONFIRM))?.detail).toBe(blocker)
    expect(tracedOfKind(harness, ReportKind.OpenRefused)[0]?.data).toStrictEqual({ reason: blocker, owner: FixtureOwner.Whitelist })
  })

  it('lets a passenger or a slow driver open', () => {
    const harness = createReadyHarness()
    harness.ports.game.setSituation({ drivenVehicleSpeed: SLOW_SPEED_METERS_PER_SECOND })
    expect(call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, LIST_PANEL)).toStrictEqual(CALL_DONE)
  })

  it('does not take its own open interface for another resource focus', () => {
    const harness = withListOpen()
    harness.store.write({ ...harness.store.read(), mode: UiMode.Panels })
    harness.ports.game.setSituation({ nuiFocused: true })
    expect(call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, ADD_PANEL)).toStrictEqual(CALL_DONE)
  })

  it('refuses during the 2 s after a close by the player, then accepts', () => {
    const harness = createReadyHarness()
    harness.store.write({ ...harness.store.read(), gate: closedByPlayer(harness.store.read().gate, harness.ports.clock.now()) })
    expect(refusal(call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, LIST_PANEL))?.detail).toBe(OpenBlocker.Cooldown)
    harness.ports.clock.advance(CLOSE_COOLDOWN_MS)
    expect(call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, LIST_PANEL)).toStrictEqual(CALL_DONE)
  })

  it('keeps the interface for the selected resource: others are Reserved, its openPanel ends the reservation', () => {
    const harness = createReadyHarness()
    reserveForSelectedOwner(harness.context, FixtureOwner.Whitelist)
    expect(refusal(call(harness, KitExport.Confirm, FixtureOwner.Garage, REMOVE_CONFIRM))?.detail).toBe(OpenBlocker.Reserved)
    expect(call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, LIST_PANEL)).toStrictEqual(CALL_DONE)
    expect(harness.store.read().gate.reservedFor).toBeNull()
  })

  it('keeps the reservation when the selected resource only asks for a confirmation', () => {
    const harness = createReadyHarness()
    reserveForSelectedOwner(harness.context, FixtureOwner.Whitelist)
    call(harness, KitExport.Confirm, FixtureOwner.Whitelist, REMOVE_CONFIRM)
    expect(harness.store.read().gate.reservedFor).toBe(FixtureOwner.Whitelist)
  })

  it('ends the reservation by itself after 1 s', () => {
    const harness = createReadyHarness()
    reserveForSelectedOwner(harness.context, FixtureOwner.Whitelist)
    harness.ports.clock.advance(RESERVATION_MS)
    expect(call(harness, KitExport.OpenPanel, FixtureOwner.Garage, LIST_PANEL)).toStrictEqual(CALL_DONE)
  })
})

describe('panel exports', () => {
  it('pushes a panel above its own parent', () => {
    const harness = withListOpen()
    expect(call(harness, KitExport.PushPanel, FixtureOwner.Whitelist, ADD_PANEL, LIST_PANEL.id)).toStrictEqual(CALL_DONE)
    expect(harness.ports.nui.sentOfType(ToPage.PushPanel)[0]?.parentId).toBe(`${FixtureOwner.Whitelist}/${LIST_PANEL.id}`)
  })

  it('names the wrong argument of a push refused for its parent', () => {
    const harness = withListOpen()
    expect(refusal(call(harness, KitExport.PushPanel, FixtureOwner.Whitelist, ADD_PANEL, 'Bad Parent'))).toStrictEqual({ path: 'parentId', code: ContractErrorCode.BadIdentifier })
  })

  it('updates its own panel and sends the namespaced descriptor', () => {
    const harness = withListOpen()
    expect(call(harness, KitExport.UpdatePanel, FixtureOwner.Whitelist, { ...LIST_PANEL, title: RENAMED_TITLE })).toStrictEqual(CALL_DONE)
    expect(harness.ports.nui.sentOfType(ToPage.UpdatePanel)[0]?.panel.panel.title).toBe(RENAMED_TITLE)
  })

  it('refuses to update a panel of another resource', () => {
    expect(refusal(call(withListOpen(), KitExport.UpdatePanel, FixtureOwner.Garage, LIST_PANEL))?.code).toBe(ContractErrorCode.UnknownPanel)
  })

  it('closes its own panel with a numbered command', () => {
    const harness = withListOpen()
    expect(call(harness, KitExport.ClosePanel, FixtureOwner.Whitelist, LIST_PANEL.id)).toStrictEqual(CALL_DONE)
    expect(harness.ports.nui.sentOfType(ToPage.ClosePanel).map((message) => message.commandSeq)).toStrictEqual([SECOND_COMMAND])
  })

  it('answers Done for a panel the player already closed, without a command', () => {
    const harness = createReadyHarness()
    expect(call(harness, KitExport.ClosePanel, FixtureOwner.Whitelist, LIST_PANEL.id)).toStrictEqual(CALL_DONE)
    expect(harness.ports.nui.sentOfType(ToPage.ClosePanel)).toStrictEqual([])
  })

  it('resolves its own open form', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, ADD_PANEL)
    expect(call(harness, KitExport.ResolveForm, FixtureOwner.Whitelist, ADD_PANEL.id, FIRST_SUBMISSION_ID, ACCEPTED_RESULT)).toStrictEqual(CALL_DONE)
    expect(harness.ports.nui.sentOfType(ToPage.ResolveForm)).toStrictEqual([
      { type: ToPage.ResolveForm, panelId: `${FixtureOwner.Whitelist}/${ADD_PANEL.id}`, submissionId: FIRST_SUBMISSION_ID, result: ACCEPTED_RESULT },
    ])
  })

  it('refuses to resolve a menu or a form it does not own', () => {
    const harness = withListOpen()
    expect(refusal(call(harness, KitExport.ResolveForm, FixtureOwner.Whitelist, LIST_PANEL.id, FIRST_SUBMISSION_ID, ACCEPTED_RESULT))?.code).toBe(ContractErrorCode.UnknownPanel)
  })

  it('refuses a negative submission number, naming the argument', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, ADD_PANEL)
    expect(refusal(call(harness, KitExport.ResolveForm, FixtureOwner.Whitelist, ADD_PANEL.id, -1, ACCEPTED_RESULT))).toStrictEqual({ path: 'submissionId', code: ContractErrorCode.OutOfRange })
  })

  it('builds ShowConfirm from the ConfirmRequest kept in the registry', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.Confirm, FixtureOwner.Whitelist, REMOVE_CONFIRM)
    expect(harness.ports.nui.sentOfType(ToPage.ShowConfirm)).toStrictEqual([
      { type: ToPage.ShowConfirm, commandSeq: 1, confirm: { owner: FixtureOwner.Whitelist, confirm: { ...REMOVE_CONFIRM, id: `${FixtureOwner.Whitelist}/${REMOVE_CONFIRM.id}` } } },
    ])
  })
})
