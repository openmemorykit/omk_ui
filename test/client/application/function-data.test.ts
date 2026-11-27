import { isRecord } from '@openmemorykit/core/shared'
import { createSerializationFake, EmptyTableShape } from '@openmemorykit/core/testing'
import { CallStatus, ContractErrorCode, KitExport, type CallResult } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { handleContractCall } from '../../../src/client/application/contract-call'
import { receiveServerNotification } from '../../../src/client/application/notify-inbox'
import { FixtureOwner } from '../../fixtures/owned'
import { LIST_PANEL } from '../../fixtures/panels'
import { GARAGE_RADIAL_ENTRY, HOLD_PROMPT, PLAIN_NOTIFICATION, REMOVE_CONFIRM } from '../../fixtures/surfaces'
import { createReadyHarness } from './use-case-harness'

const noop = (): undefined => undefined

const PAYLOADS_WITH_FUNCTIONS: readonly (readonly [KitExport, unknown])[] = [
  [KitExport.OpenPanel, { ...LIST_PANEL, onSelect: noop }],
  [KitExport.OpenPanel, { ...LIST_PANEL, items: [{ ...LIST_PANEL.items[0], onToggle: noop }] }],
  [KitExport.Confirm, { ...REMOVE_CONFIRM, onAnswer: noop }],
  [KitExport.AddRadialEntry, { ...GARAGE_RADIAL_ENTRY, icon: noop }],
  [KitExport.ShowPrompt, { ...HOLD_PROMPT, onComplete: noop }],
  [KitExport.Notify, { ...PLAIN_NOTIFICATION, extra: { deep: [noop] } }],
  [KitExport.OpenPanel, { ...LIST_PANEL, toJSON: noop }],
]

function holdsFunction(value: unknown): boolean {
  if (value instanceof Function) return true
  if (Array.isArray(value)) return value.some(holdsFunction)
  return isRecord(value) && Object.values(value).some(holdsFunction)
}

function refusalCodes(result: CallResult): readonly ContractErrorCode[] {
  return result.status === CallStatus.Refused ? result.errors.map((error) => error.code) : []
}

describe('functions passed as data (msgpack fake)', () => {
  it.each(PAYLOADS_WITH_FUNCTIONS)('refuses %s with a function inside, never calls it and never keeps it', (name, payload) => {
    const serialization = createSerializationFake(EmptyTableShape.Object)
    const harness = createReadyHarness()
    const result = handleContractCall(harness.context, name, FixtureOwner.Whitelist, [serialization.cross(payload)])
    expect(refusalCodes(result)).toContain(ContractErrorCode.FunctionNotAllowed)
    expect(serialization.functionReferences().every((reference) => reference.calls.length === 0)).toBe(true)
    const { registry, link } = harness.store.read()
    expect([registry.stack, registry.confirms, registry.radialEntries, registry.prompts, link.queuedNotifications]).toStrictEqual([[], [], [], [], []])
    expect(harness.ports.nui.sent).toStrictEqual([])
  })

  it('never calls a toJSON function received in a payload, even while measuring its size', () => {
    const serialization = createSerializationFake(EmptyTableShape.Object)
    const harness = createReadyHarness()
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [serialization.cross({ ...LIST_PANEL, toJSON: noop })])
    expect(serialization.functionReferences()).toHaveLength(1)
    expect(serialization.functionReferences().every((reference) => reference.calls.length === 0)).toBe(true)
  })

  it('refuses a function in a notification from the server', () => {
    const serialization = createSerializationFake(EmptyTableShape.List)
    const harness = createReadyHarness()
    receiveServerNotification(harness.context, serialization.cross({ ...PLAIN_NOTIFICATION, title: noop }))
    expect(serialization.functionReferences().every((reference) => reference.calls.length === 0)).toBe(true)
    expect(harness.ports.nui.sent).toStrictEqual([])
  })

  it('accepts the same payloads crossed without functions, and keeps none', () => {
    const serialization = createSerializationFake(EmptyTableShape.List)
    const harness = createReadyHarness()
    expect(handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [serialization.cross(LIST_PANEL)]).status).toBe(CallStatus.Done)
    expect(holdsFunction(harness.store.read())).toBe(false)
    expect(holdsFunction(harness.ports.nui.sent)).toBe(false)
  })
})
