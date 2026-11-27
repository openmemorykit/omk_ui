import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { CallStatus, ContractErrorCode, ContractVersion, IconName, KitExport, type CallResult } from '@openmemorykit/ui/contract'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FromPage } from '../../../src/protocol/from-page'
import { Intent } from '../../../src/protocol/intents'
import { ToPage } from '../../../src/protocol/to-page'
import { CommandKind, NetEvent } from '../../../src/shared/net/net-events'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { KEYED_NOTIFICATION } from '../../fixtures/surfaces'

const RESOURCE_NAME = 'omk_ui'
const WRONG_NAME = 'omk_ui_copy'
const MAIN_PATH = '../../../src/client/main'
const KIT_VERSION = '9.9.9-test'
const GARAGE = 'garage'
const RESOURCE_STOP_EVENT = 'onResourceStop'
const PAGE_CALLBACK_COUNT = Object.values(FromPage).length
const VERSION_EXPORT = 'version'
const KIT_MODULE = '../../../src/client/application/client-kit'
const GLYPHS_COMMAND = 'omk_glyphs'
const SEND_NUI_NATIVE = 'SendNuiMessage'
const EMIT_NATIVE = 'emit'
const READY_EVENT = 'omk_ui:ready'
const KEY_MAPPING_COUNT = 2
const GLYPH_SET_ARGUMENT = 'xbox'
const SNAPSHOT_TIMER_MS = 2001
const SNAPSHOT_REQUEST_ID = 5
const FIRST_EARLY_FAILURE = 'first early message failed'

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
  readonly lines: string[]
}

let started: StartedClient | null = null
let gameTime = 0
let invokingResource = GARAGE

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
    GetInvokingResource: () => invokingResource,
    RegisterCommand: () => undefined,
    RegisterKeyMapping: () => undefined,
    TriggerEvent: () => undefined,
    setTick: () => 1,
    clearTick: () => undefined,
    setTimeout: () => 1,
    GetGameTimer: () => gameTime,
    GetConvar: (_name: string, fallback: string) => fallback,
    LoadResourceFile: () => null,
    GetResourceKvpString: () => null,
    SetResourceKvp: () => undefined,
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
  const lines: string[] = []
  gameTime = 0
  invokingResource = GARAGE
  vi.spyOn(console, 'error').mockImplementation((...line: unknown[]) => void errors.push(line))
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(String(line)))
  const records: ClientRecords = { nuiCallbacks: new Map(), exportsByName: new Map(), eventHandlers: new Map() }
  const natives = installClientNatives(resourceName, records)
  Object.assign(globalThis.exports, { [RESOURCE_NAME]: { getConfig: () => (onConfigRead(records), {}) } })
  started = { ...records, natives, errors, lines }
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

function sendFromServer(client: StartedClient, event: NetEvent, command: object): void {
  invokingResource = ''
  ;(client.eventHandlers.get(event) as ((payload: object) => void) | undefined)?.(command)
  invokingResource = GARAGE
}

function reportKinds(client: StartedClient): readonly unknown[] {
  return client.natives.callsOf('emitNet').map(([, envelope]) => (envelope as { readonly kind: unknown }).kind)
}

function becomeReady(client: StartedClient): void {
  client.nuiCallbacks.get(FromPage.Ready)?.({ type: FromPage.Ready }, () => undefined)
}

afterEach(() => {
  vi.doUnmock(KIT_MODULE)
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

  it('replays an early ready after the key mappings and the exports exist, and announces omk_ui:ready after the exports', async () => {
    const client = await startClient(RESOURCE_NAME, (records) => records.nuiCallbacks.get(FromPage.Ready)?.({ type: FromPage.Ready }, () => undefined))
    const names = client.natives.calls.map((call) => call.name)
    const bootAt = client.natives.calls.findIndex((call) => call.name === SEND_NUI_NATIVE && String(call.args[0]).includes(ToPage.Boot))
    const readyAt = client.natives.calls.findIndex((call) => call.name === EMIT_NATIVE && call.args[0] === READY_EVENT)
    expect(bootAt).toBeGreaterThan(names.lastIndexOf('RegisterKeyMapping'))
    expect(bootAt).toBeGreaterThan(names.lastIndexOf('exports'))
    expect(readyAt).toBeGreaterThan(names.lastIndexOf('exports'))
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

  it('registers the two key mappings and the omk_glyphs command', async () => {
    const client = await startClient()
    expect(client.natives.callsOf('RegisterKeyMapping')).toHaveLength(KEY_MAPPING_COUNT)
    expect(client.natives.callsOf('RegisterCommand').map(([name]) => name)).toContain(GLYPHS_COMMAND)
  })

  it('changes the glyph set when the omk_glyphs command runs', async () => {
    const client = await startClient()
    const glyphs = client.natives.callsOf('RegisterCommand').find(([name]) => name === GLYPHS_COMMAND)
    ;(glyphs?.[1] as (source: number, args: string[]) => void)(0, [GLYPH_SET_ARGUMENT])
    expect(sentToPage(client)).toContain(ToPage.GlyphSet)
  })

  it('answers a snapshot command without the page once the two-second timer fires', async () => {
    const client = await startClient()
    becomeReady(client)
    sendFromServer(client, NetEvent.Command, { kind: CommandKind.Snapshot, requestId: SNAPSHOT_REQUEST_ID })
    const timer = client.natives.callsOf('setTimeout').find(([, delayMs]) => delayMs === SNAPSHOT_TIMER_MS)
    expect(timer).toBeDefined()
    expect(reportKinds(client)).not.toContain(ReportKind.Snapshot)
    gameTime += SNAPSHOT_TIMER_MS
    ;(timer?.[0] as () => void)()
    expect(reportKinds(client)).toContain(ReportKind.Snapshot)
  })

  it('moves the page when the server sends a command event', async () => {
    const client = await startClient()
    becomeReady(client)
    sendFromServer(client, NetEvent.Command, { kind: CommandKind.Intent, intent: Intent.Down, count: 1 })
    expect(sentToPage(client)).toContain(ToPage.Intent)
  })

  it('shows the notification of a server notify event on the page', async () => {
    const client = await startClient()
    becomeReady(client)
    sendFromServer(client, NetEvent.Notify, { kind: CommandKind.Notify, notification: KEYED_NOTIFICATION })
    expect(sentToPage(client)).toContain(ToPage.Notify)
  })

  it('sends the lines held back to the server once a server trace event turns the journal on', async () => {
    const client = await startClient()
    callExport(client, KitExport.AddRadialEntry, {})
    expect(client.natives.callsOf('emitNet')).toStrictEqual([])
    sendFromServer(client, NetEvent.Trace, { kind: CommandKind.Trace, active: true })
    expect(reportKinds(client)).toContain(ReportKind.ContractRefused)
  })

  it('keeps the exports and the key mappings when the first replayed page message throws, and reports it', async () => {
    const messages: string[] = []
    const kit = { pageMessage: (type: string) => { messages.push(type); if (messages.length === 1) throw new Error(FIRST_EARLY_FAILURE) } }
    vi.doMock(KIT_MODULE, () => ({ createClientKit: () => kit }))
    const client = await startClient(RESOURCE_NAME, (records) => {
      records.nuiCallbacks.get(FromPage.Ready)?.({ type: FromPage.Ready }, () => undefined)
      records.nuiCallbacks.get(FromPage.Snapshot)?.({ type: FromPage.Snapshot }, () => undefined)
    })
    expect(messages).toStrictEqual([FromPage.Ready, FromPage.Snapshot])
    expect(client.lines.filter((line) => line.includes(FIRST_EARLY_FAILURE))).toHaveLength(1)
    expect([...client.exportsByName.keys()]).toEqual(expect.arrayContaining(Object.values(KitExport)))
    expect(client.natives.callsOf('RegisterKeyMapping')).toHaveLength(KEY_MAPPING_COUNT)
  })

  it('reports a failure while building the kit with one line instead of throwing', async () => {
    vi.doMock(KIT_MODULE, () => ({ createClientKit: () => { throw new Error(FIRST_EARLY_FAILURE) } }))
    const client = await startClient()
    expect(client.lines.filter((line) => line.includes(FIRST_EARLY_FAILURE))).toHaveLength(1)
  })
})
