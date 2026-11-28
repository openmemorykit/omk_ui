import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import english from '../../../omk_ui/locales/en.json'
import french from '../../../omk_ui/locales/fr.json'
import { SNAPSHOT_TIMEOUT_MS } from '../../../src/server/application/snapshot-requests'

const RESOURCE_NAME = 'omk_ui'
const WRONG_NAME = 'omk_ui_copy'
const MAIN_PATH = '../../../src/server/main'
const KIT_VERSION = '9.9.9-test'
const KIT_COMMAND = 'omk_ui'
const CONSOLE_SOURCE = 0
const PLAYER_SOURCE = 7
const NOTIFY_EXPORT = 'notify'
const DENIED_LINE = 'omk_ui.admin'
const KIT_MODULE = '../../../src/server/application/server-kit'
const NOTIFY_EXPORT_MODULE = '../../../src/server/infrastructure/notify-export'
const REGISTRATION_FAILURE = 'the export could not be registered'
const KIT_FAILURE = 'the kit could not be built'
const NO_REPLY_KEY = 'log.debug.noReply'

type Handler = (...args: never[]) => unknown
type CommandHandler = (source: number, args: string[]) => void

interface ServerRecords {
  readonly commands: Map<string, CommandHandler>
  readonly exportsByName: Map<string, Handler>
  readonly netHandlers: Map<string, Handler>
  readonly timers: { readonly delayMs: number; readonly fire: () => void }[]
}

interface StartedServer extends ServerRecords {
  readonly natives: NativeRecorder
  readonly errors: unknown[][]
  readonly lines: string[]
}

let started: StartedServer | null = null
let gameTime = 0

const LOCALE_FILES: ReadonlyMap<string, string> = new Map([
  ['locales/en.json', JSON.stringify(english)],
  ['locales/fr.json', JSON.stringify(french)],
])

function installServerNatives(resourceName: string, records: ServerRecords): NativeRecorder {
  return installNatives({
    GetCurrentResourceName: () => resourceName,
    RegisterCommand: (name: string, handler: CommandHandler) => void records.commands.set(name, handler),
    exports: (name: string, handler: Handler) => void records.exportsByName.set(name, handler),
    on: () => undefined,
    onNet: (name: string, handler: Handler) => void records.netHandlers.set(name, handler),
    emit: () => undefined,
    emitNet: () => undefined,
    removeEventListener: () => undefined,
    TriggerClientEvent: () => undefined,
    IsPlayerAceAllowed: () => false,
    GetInvokingResource: () => 'garage',
    GetConvar: (_name: string, fallback: string) => fallback,
    LoadResourceFile: (_resource: string, path: string) => LOCALE_FILES.get(path) ?? null,
    GetGameTimer: () => gameTime,
    GetNumPlayerIndices: () => 0,
    GetPlayerFromIndex: () => null,
    DoesPlayerExist: () => true,
    setTimeout: (fire: () => void, delayMs: number) => void records.timers.push({ delayMs, fire }),
  })
}

async function startServer(resourceName = RESOURCE_NAME): Promise<StartedServer> {
  vi.resetModules()
  vi.stubGlobal('__OMK_VERSION__', KIT_VERSION)
  gameTime = 0
  const errors: unknown[][] = []
  const lines: string[] = []
  vi.spyOn(console, 'error').mockImplementation((...line: unknown[]) => void errors.push(line))
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(String(line)))
  const records: ServerRecords = { commands: new Map(), exportsByName: new Map(), netHandlers: new Map(), timers: [] }
  const natives = installServerNatives(resourceName, records)
  Object.assign(globalThis.exports, { [RESOURCE_NAME]: { getConfig: () => ({}) } })
  started = { ...records, natives, errors, lines }
  await import(MAIN_PATH)
  return started
}

afterEach(() => {
  vi.doUnmock(KIT_MODULE)
  vi.doUnmock(NOTIFY_EXPORT_MODULE)
  started?.natives.restore()
  started = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('server main', () => {
  it('refuses to start under another folder name with one line, registering nothing', async () => {
    const server = await startServer(WRONG_NAME)
    expect(server.errors).toHaveLength(1)
    expect(String(server.errors[0]?.[0])).toContain(`${RESOURCE_NAME} refuses to start`)
    expect(server.commands.size).toBe(0)
    expect(server.exportsByName.size).toBe(0)
    expect(server.netHandlers.size).toBe(0)
    expect(server.lines).toStrictEqual([])
  })

  it('registers the command, the notify export and the report event, then prints the startup summary', async () => {
    const server = await startServer()
    expect([...server.commands.keys()]).toStrictEqual([KIT_COMMAND])
    expect([...server.exportsByName.keys()]).toStrictEqual([NOTIFY_EXPORT])
    expect(server.netHandlers.size).toBe(1)
    expect(server.lines.some((line) => line.includes(KIT_VERSION))).toBe(true)
    expect(server.errors).toStrictEqual([])
  })

  it('answers a subcommand on the console and arms the snapshot timer after it', async () => {
    const server = await startServer()
    server.lines.length = 0
    server.commands.get(KIT_COMMAND)?.(CONSOLE_SOURCE, ['version'])
    expect(server.lines.some((line) => line.includes(KIT_VERSION))).toBe(true)
    expect(server.timers.map((timer) => timer.delayMs)).toStrictEqual([SNAPSHOT_TIMEOUT_MS + 1])
  })

  it('prints the "no reply" line for a player who stayed silent once the timer fires after three seconds', async () => {
    const server = await startServer()
    server.lines.length = 0
    server.commands.get(KIT_COMMAND)?.(CONSOLE_SOURCE, ['debug', String(PLAYER_SOURCE)])
    gameTime += SNAPSHOT_TIMEOUT_MS + 1
    server.timers.forEach((timer) => timer.fire())
    const noReplyLines = [english, french].map((bundle) => bundle[NO_REPLY_KEY].replace('{player}', String(PLAYER_SOURCE)))
    expect(server.lines.some((line) => noReplyLines.some((noReply) => line.endsWith(noReply)))).toBe(true)
  })

  it('reports a failure while building the kit with one line instead of throwing', async () => {
    vi.doMock(KIT_MODULE, () => ({ createServerKit: () => { throw new Error(KIT_FAILURE) } }))
    const server = await startServer()
    expect(server.lines.filter((line) => line.includes(KIT_FAILURE))).toHaveLength(1)
    expect(server.commands.size).toBe(0)
  })

  it('keeps registering the other entry points when one registration throws, and reports it once', async () => {
    vi.doMock(NOTIFY_EXPORT_MODULE, () => ({ registerNotifyExport: () => { throw new Error(REGISTRATION_FAILURE) } }))
    const server = await startServer()
    expect([...server.commands.keys()]).toStrictEqual([KIT_COMMAND])
    expect(server.netHandlers.size).toBe(1)
    expect(server.lines.filter((line) => line.includes(REGISTRATION_FAILURE))).toHaveLength(1)
    expect(server.lines.some((line) => line.includes(KIT_VERSION))).toBe(true)
  })

  it('answers an unknown subcommand with the list of subcommands', async () => {
    const server = await startServer()
    server.lines.length = 0
    server.commands.get(KIT_COMMAND)?.(CONSOLE_SOURCE, ['nothing'])
    expect(server.lines.join('\n')).toContain('nothing')
    expect(server.lines.join('\n')).toContain('version')
  })

  it('refuses a player without the admin permission with one translated line', async () => {
    const server = await startServer()
    server.lines.length = 0
    server.commands.get(KIT_COMMAND)?.(PLAYER_SOURCE, ['version'])
    expect(server.lines).toHaveLength(1)
    expect(server.lines[0]).toContain(DENIED_LINE)
  })
})
