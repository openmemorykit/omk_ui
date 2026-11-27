import { CALL_BURST, CALL_DONE, CALL_MAX_BYTES, CallStatus, ContractErrorCode, ContractVersion, KitExport, type CallResult } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { callExport, handleContractCall, KitQuery } from '../../../src/client/application/contract-call'
import { INITIAL_CLIENT_SESSION } from '../../../src/client/application/session-state'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../src/protocol/to-page'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { FixtureOwner } from '../../fixtures/owned'
import { LIST_PANEL } from '../../fixtures/panels'
import { createHarness, createReadyHarness, KIT_VERSION, tracedOfKind } from './use-case-harness'

const EXTRA_CALLS = 3
const HUGE_CHUNK_LENGTH = 1000
const HUGE_CHUNKS = 2000

const UNKNOWN_FIELD = 'colour'
const CYCLIC_FIELD = 'self'

function refusalCode(result: CallResult): ContractErrorCode | undefined {
  return result.status === CallStatus.Refused ? result.errors[0]?.code : undefined
}

describe('callExport', () => {
  it('answers version() with the kit version passed in and the contract version', () => {
    expect(callExport(createHarness().context, KitQuery.Version, FixtureOwner.Whitelist, [])).toStrictEqual({ kit: KIT_VERSION, contract: ContractVersion.V1 })
  })

  it('answers isOpen() from the mode', () => {
    expect(callExport(createHarness().context, KitQuery.IsOpen, FixtureOwner.Whitelist, [])).toBe(false)
    expect(callExport(createHarness({ ...INITIAL_CLIENT_SESSION, mode: UiMode.Panels }).context, KitQuery.IsOpen, null, [])).toBe(true)
  })

  it('handles every other export as a contract call', () => {
    expect(callExport(createReadyHarness().context, KitExport.OpenPanel, FixtureOwner.Whitelist, [LIST_PANEL])).toStrictEqual(CALL_DONE)
  })
})

describe('handleContractCall', () => {
  it.each([null, '', 'a/b', '__proto__'])('refuses the owner %s without recording anything', (owner) => {
    const harness = createReadyHarness()
    expect(refusalCode(handleContractCall(harness.context, KitExport.OpenPanel, owner, [LIST_PANEL]))).toBe(ContractErrorCode.BadIdentifier)
    expect(harness.store.read().registry.stack).toStrictEqual([])
  })

  it('admits the call before normalizing it: a rate-limited caller gets RateLimited even with a function inside', () => {
    const harness = createReadyHarness()
    Array.from({ length: CALL_BURST }, () => handleContractCall(harness.context, KitExport.ClosePanel, FixtureOwner.Whitelist, ['list']))
    const withFunction = { ...LIST_PANEL, onSelect: () => undefined }
    expect(refusalCode(handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [withFunction]))).toBe(ContractErrorCode.RateLimited)
  })

  it('counts refused payloads against the rate limit too', () => {
    const harness = createReadyHarness()
    Array.from({ length: CALL_BURST }, () => handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [{}]))
    expect(refusalCode(handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [LIST_PANEL]))).toBe(ContractErrorCode.RateLimited)
  })

  it('writes one CallLimited line per owner and per second', () => {
    const harness = createReadyHarness()
    Array.from({ length: CALL_BURST + EXTRA_CALLS }, () => handleContractCall(harness.context, KitExport.ClosePanel, FixtureOwner.Whitelist, ['list']))
    expect(tracedOfKind(harness, ReportKind.CallLimited)).toHaveLength(1)
  })

  it('refuses a payload larger than 256 KB with TooLarge', () => {
    const huge = { ...LIST_PANEL, subtitle: 'x'.repeat(CALL_MAX_BYTES) }
    expect(refusalCode(handleContractCall(createReadyHarness().context, KitExport.OpenPanel, FixtureOwner.Whitelist, [huge]))).toBe(ContractErrorCode.TooLarge)
  })

  it('never reads a getter while measuring, and refuses the payload as not serializable', () => {
    let read = false
    const trapped = { ...LIST_PANEL, get subtitle(): string { read = true; return 'x' } }
    expect(refusalCode(handleContractCall(createReadyHarness().context, KitExport.OpenPanel, FixtureOwner.Whitelist, [trapped]))).toBe(ContractErrorCode.WrongType)
    expect(read).toBe(false)
  })

  it('refuses a huge payload as TooLarge without visiting what comes after the limit', () => {
    let visited = false
    const beyond = new Proxy({}, { ownKeys: () => { visited = true; return [] } })
    const chunk = 'x'.repeat(HUGE_CHUNK_LENGTH)
    const huge = { ...LIST_PANEL, items: [...Array.from({ length: HUGE_CHUNKS }, () => ({ chunk })), beyond] }
    expect(refusalCode(handleContractCall(createReadyHarness().context, KitExport.OpenPanel, FixtureOwner.Whitelist, [huge]))).toBe(ContractErrorCode.TooLarge)
    expect(visited).toBe(false)
  })

  it('refuses a payload that cannot be measured', () => {
    const cyclic: Record<string, unknown> = { ...LIST_PANEL }
    cyclic[CYCLIC_FIELD] = cyclic
    expect(refusalCode(handleContractCall(createReadyHarness().context, KitExport.OpenPanel, FixtureOwner.Whitelist, [cyclic]))).toBe(ContractErrorCode.WrongType)
  })

  it('refuses a missing argument with Missing', () => {
    expect(refusalCode(handleContractCall(createReadyHarness().context, KitExport.OpenPanel, FixtureOwner.Whitelist, []))).toBe(ContractErrorCode.Missing)
  })

  it('logs a refused contract with its owner, path and code, and prints it in the client console', () => {
    const harness = createReadyHarness()
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [{ ...LIST_PANEL, id: 'Bad Id' }])
    expect(tracedOfKind(harness, ReportKind.ContractRefused)[0]?.data).toStrictEqual({ owner: FixtureOwner.Whitelist, errors: [{ path: 'id', code: ContractErrorCode.BadIdentifier }] })
    expect(harness.ports.console.printed).toHaveLength(1)
  })

  it('logs an unknown field once per owner and path, and still accepts the call', () => {
    const harness = createReadyHarness()
    const panel = { ...LIST_PANEL, [UNKNOWN_FIELD]: 'red' }
    expect(handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [panel])).toStrictEqual(CALL_DONE)
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [panel])
    expect(tracedOfKind(harness, ReportKind.UnknownField).map((line) => line.data)).toStrictEqual([{ owner: FixtureOwner.Whitelist, path: UNKNOWN_FIELD }])
  })

  it('registers an accepted panel and sends it to the page with the next command number', () => {
    const harness = createReadyHarness()
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [LIST_PANEL])
    expect(harness.store.read().registry.stack.map((registered) => registered.panel.id)).toStrictEqual([LIST_PANEL.id])
    expect(harness.ports.nui.sentOfType(ToPage.OpenPanel).map((message) => message.commandSeq)).toStrictEqual([1])
  })

  it('refuses an occupied interface through the registry', () => {
    const harness = createReadyHarness()
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [LIST_PANEL])
    expect(refusalCode(handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Garage, [LIST_PANEL]))).toBe(ContractErrorCode.Occupied)
  })

  it('stores validated copies only, never the caller object', () => {
    const harness = createReadyHarness()
    const panel = { ...LIST_PANEL }
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [panel])
    expect(harness.store.read().registry.stack[0]?.panel).not.toBe(panel)
  })
})
