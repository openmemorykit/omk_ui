import { createExportsFake, createSerializationFake, EmptyTableShape, installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { CallStatus, ContractErrorCode, KitExport, type CallResult } from '@openmemorykit/ui/contract'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerKitExports } from '../../../src/client/infrastructure/exports'

const OWN_NAME = 'omk_ui'
const TWO_CALLS = 2
const KIT_QUERIES = ['version', 'isOpen']

let natives: NativeRecorder | null = null
let invoking = 'garage'
const failures: unknown[][] = []

afterEach(() => {
  natives?.restore()
  natives = null
  vi.unstubAllGlobals()
  failures.length = 0
  invoking = 'garage'
})

interface Call { readonly name: string; readonly owner: string | null; readonly args: readonly unknown[] }

function setUp(callExport: (name: string, owner: string | null, args: readonly unknown[]) => unknown): ReturnType<typeof createExportsFake> {
  const fake = createExportsFake(createSerializationFake(EmptyTableShape.Object), OWN_NAME)
  vi.stubGlobal('exports', fake.exports)
  natives = installNatives({ GetInvokingResource: () => invoking })
  registerKitExports(callExport, (operation, cause) => { failures.push([operation, cause]) })
  return fake
}

describe('registerKitExports', () => {
  it('reports a registration that throws and still registers the following exports', () => {
    const registeredNames: string[] = []
    const boom = new Error('taken')
    natives = installNatives({ GetInvokingResource: () => invoking })
    vi.stubGlobal('exports', (name: string) => { if (registeredNames.length === 0) { registeredNames.push('failed'); throw boom } registeredNames.push(name) })
    registerKitExports(() => null, (operation, cause) => { failures.push([operation, cause]) })
    const expected = [...Object.values(KitExport), ...KIT_QUERIES]
    expect(registeredNames).toEqual(['failed', ...expected.slice(1)])
    expect(failures).toEqual([[`register export ${expected[0]}`, boom]])
  })

  it('registers every kit export plus version and isOpen', () => {
    const calls: Call[] = []
    const fake = setUp((name, owner, args) => { calls.push({ name, owner, args }); return null })
    const expected = [...Object.values(KitExport), ...KIT_QUERIES]
    expected.forEach((name) => fake.exports[OWN_NAME]?.[name]?.())
    expect(calls.map((call) => call.name)).toEqual(expected)
  })

  it('takes the owner from GetInvokingResource, read when the export is called', () => {
    const calls: Call[] = []
    const fake = setUp((name, owner, args) => { calls.push({ name, owner, args }); return null })
    invoking = 'whitelist'
    fake.exports[OWN_NAME]?.['openPanel']?.({ id: 'a' })
    invoking = 'garage'
    fake.exports[OWN_NAME]?.['openPanel']?.({ id: 'b' })
    expect(calls.map((call) => call.owner)).toEqual(['whitelist', 'garage'])
    expect(natives?.callsOf('GetInvokingResource')).toHaveLength(TWO_CALLS)
  })

  it('gives a null owner when GetInvokingResource is empty', () => {
    const calls: Call[] = []
    const fake = setUp((name, owner, args) => { calls.push({ name, owner, args }); return null })
    invoking = ''
    fake.exports[OWN_NAME]?.['notify']?.({ id: 'a' })
    expect(calls[0]?.owner).toBeNull()
  })

  it('passes the arguments through and returns what the kit returns', () => {
    const calls: Call[] = []
    const fake = setUp((name, owner, args) => { calls.push({ name, owner, args }); return { status: 'done' } })
    expect(fake.exports[OWN_NAME]?.['pushPanel']?.({ id: 'a' }, 'parent')).toEqual({ status: 'done' })
    expect(calls[0]?.args).toEqual([{ id: 'a' }, 'parent'])
  })

  it('answers a refusal and reports when the kit throws', () => {
    const boom = new Error('boom')
    const fake = setUp(() => { throw boom })
    const result = fake.exports[OWN_NAME]?.['openPanel']?.({}) as CallResult
    expect(result.status).toBe(CallStatus.Refused)
    expect(result.status === CallStatus.Refused ? result.errors[0]?.code : null).toBe(ContractErrorCode.WrongType)
    expect(failures).toEqual([['export openPanel', boom]])
  })

  it('answers false for isOpen when the kit throws', () => {
    const fake = setUp(() => { throw new Error('boom') })
    expect(fake.exports[OWN_NAME]?.['isOpen']?.()).toBe(false)
  })

  it('answers a refusal when GetInvokingResource throws', () => {
    const fake = setUp(() => ({ status: 'done' }))
    natives?.restore()
    natives = installNatives({ GetInvokingResource: () => { throw new Error('boom') } })
    const result = fake.exports[OWN_NAME]?.['closePanel']?.('a') as CallResult
    expect(result.status).toBe(CallStatus.Refused)
    expect(failures.length).toBe(1)
  })
})
