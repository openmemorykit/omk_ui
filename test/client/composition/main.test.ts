import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { CallStatus, ContractErrorCode, ContractVersion, IconName, KitExport, type CallResult } from '@openmemorykit/ui/contract'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FromPage } from '../../../src/protocol/from-page'
import { ToPage } from '../../../src/protocol/to-page'

const RESOURCE_NAME = 'omk_ui'
const WRONG_NAME = 'omk_ui_copy'
const MAIN_PATH = '../../../src/client/main'
const KIT_VERSION = '9.9.9-test'
const GARAGE = 'garage'
const RESOURCE_STOP_EVENT = 'onResourceStop'
const PAGE_CALLBACK_COUNT = Object.values(FromPage).length
const VERSION_EXPORT = 'version'

type Handler = (...args: never[]) => unknown
type NuiCallback = (body: unknown, answerPage: (answer: unknown) => void) => void

interface ClientRecords {
  readonly nuiCallbacks: Map<string, NuiCallback>
  readonly exportsByName: Map<string, Handler>
  readonly eventHandlers: Map<string, Handler>
}

interface StartedClient extends ClientRecords {
  readonly natives: NativeRecorder
  readonly errors: unknown[][]
}

let started: StartedClient | null = null

function installClientNatives(resourceName: string, records: ClientRecords): NativeRecorder {
  return installNatives({
    GetCurrentResourceName: () => resourceName,
    RegisterNuiCallback: (type: string, callback: NuiCallback) => void records.nuiCallbacks.set(type, callback),
    exports: (name: string, handler: Handler) => void records.exportsByName.set(name, handler),
    on: (name: string, handler: Handler) => void records.eventHandlers.set(name, handler),
    onNet: (name: string, handler: Handler) => void records.eventHandlers.set(name, handler),
    emit: () => undefined,
    emitNet: () => undefined,
    removeEventListener: () => undefined,
    GetInvokingResource: () => GARAGE,
    RegisterCommand: () => undefined,
    RegisterKeyMapping: () => undefined,
    TriggerEvent: () => undefined,
    setTick: () => 1,
    clearTick: () => undefined,
    setTimeout: () => 1,
    GetGameTimer: () => 0,
    GetConvar: (_name: string, fallback: string) => fallback,
    LoadResourceFile: () => null,
    GetResourceKvpString: () => null,
    SendNuiMessage: () => undefined,
    SetNuiFocus: () => undefined,
    SetNuiFocusKeepInput: () => undefined,
    IsNuiFocusKeepingInput: () => false,
    GetControlInstructionalButton: () => '~INPUT_F1~',
    GetHashKey: () => 1,
  })
}

async function startClient(resourceName = RESOURCE_NAME, onConfigRead: (records: ClientRecords) => void = () => undefined): Promise<StartedClient> {
  vi.resetModules()
  vi.stubGlobal('__OMK_VERSION__', KIT_VERSION)
  const errors: unknown[][] = []
  vi.spyOn(console, 'error').mockImplementation((...line: unknown[]) => void errors.push(line))
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  const records: ClientRecords = { nuiCallbacks: new Map(), exportsByName: new Map(), eventHandlers: new Map() }
  const natives = installClientNatives(resourceName, records)
  Object.assign(globalThis.exports, { [RESOURCE_NAME]: { getConfig: () => (onConfigRead(records), {}) } })
  started = { ...records, natives, errors }
  await import(MAIN_PATH)
  return started
}

function sentToPage(client: StartedClient): readonly string[] {
  return client.natives.callsOf('SendNuiMessage').map(([json]) => (JSON.parse(String(json)) as { readonly type: string }).type)
}

function callExport(client: StartedClient, name: string, ...args: unknown[]): unknown {
  const handler = client.exportsByName.get(name) as ((...values: unknown[]) => unknown) | undefined
  return handler?.(...args)
}

function radialEntry(id: string): object {
  return { version: ContractVersion.V1, id, label: id, description: id, icon: IconName.List }
}

afterEach(() => {
  started?.natives.restore()
  started = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('client main', () => {
  it('refuses to start under another folder name with one line, registering nothing', async () => {
    const client = await startClient(WRONG_NAME)
    expect(client.errors).toHaveLength(1)
    expect(String(client.errors[0]?.[0])).toContain(`${RESOURCE_NAME} refuses to start`)
    expect(String(client.errors[0]?.[0])).toContain(WRONG_NAME)
    expect(client.natives.callsOf('RegisterNuiCallback')).toStrictEqual([])
    expect(client.exportsByName.size).toBe(0)
    expect(client.natives.calls.map((call) => call.name)).toStrictEqual(['GetCurrentResourceName'])
  })

  it('registers one NUI callback per page message right after the name check, before any other native', async () => {
    const client = await startClient()
    const names = client.natives.calls.map((call) => call.name)
    expect(names.slice(0, PAGE_CALLBACK_COUNT + 1)).toStrictEqual(['GetCurrentResourceName', ...Object.values(FromPage).map(() => 'RegisterNuiCallback')])
    expect([...client.nuiCallbacks.keys()]).toStrictEqual(Object.values(FromPage))
    expect(client.errors).toStrictEqual([])
  })

  it('replays a ready the page sent before the kit was built', async () => {
    const client = await startClient(RESOURCE_NAME, (records) => records.nuiCallbacks.get(FromPage.Ready)?.({ type: FromPage.Ready }, () => undefined))
    expect(sentToPage(client)).toContain(ToPage.Boot)
  })

  it('registers the exports, which answer with the kit version', async () => {
    const client = await startClient()
    expect(callExport(client, VERSION_EXPORT)).toStrictEqual({ kit: KIT_VERSION, contract: ContractVersion.V1 })
    expect([...client.exportsByName.keys()]).toEqual(expect.arrayContaining(Object.values(KitExport)))
  })

  it('gives the focus back to the game when omk_ui itself stops', async () => {
    const client = await startClient()
    client.eventHandlers.get(RESOURCE_STOP_EVENT)?.(RESOURCE_NAME as never)
    expect(client.natives.callsOf('SetNuiFocus')).toStrictEqual([[false, false]])
    expect(client.natives.callsOf('SetNuiFocusKeepInput')).toStrictEqual([[false]])
  })

  it('forgets what another resource held when it stops', async () => {
    const client = await startClient()
    ;['first', 'second'].forEach((id) => callExport(client, KitExport.AddRadialEntry, radialEntry(id)))
    const refused = callExport(client, KitExport.AddRadialEntry, radialEntry('third')) as CallResult
    expect(refused.status === CallStatus.Refused ? refused.errors[0]?.code : null).toBe(ContractErrorCode.QuotaExceeded)
    client.eventHandlers.get(RESOURCE_STOP_EVENT)?.(GARAGE as never)
    expect(callExport(client, KitExport.AddRadialEntry, radialEntry('third'))).toStrictEqual({ status: CallStatus.Done })
  })
})
