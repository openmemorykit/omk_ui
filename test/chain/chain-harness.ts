import type { ValueOf } from '@openmemorykit/core/shared'
import type { Reply } from '@openmemorykit/ui/contract'
import { createClientKit, type ClientKit } from '../../src/client/application/client-kit'
import type { NuiPort, ServerChannel } from '../../src/client/application/ports'
import { createUiStore } from '../../src/page/application/ui-store'
import type { UiStore } from '../../src/page/application/ports'
import { FromPage, type FromPageMessage } from '../../src/protocol/from-page'
import type { OwnedReply } from '../../src/protocol/stack'
import type { ToPageMessage } from '../../src/protocol/to-page'
import type { ClientChannel } from '../../src/server/application/ports'
import { ALL_CLIENTS } from '../../src/server/application/ports'
import type { OmkSubcommand } from '../../src/server/application/omk-subcommand'
import { createServerKit } from '../../src/server/application/server-kit'
import type { ServerKit } from '../../src/server/application/ports'
import { DEFAULT_CONFIG } from '../../src/shared/config/config-schema'
import type { ServerToClientCommand } from '../../src/shared/net/net-events'
import type { ReportEnvelope } from '../../src/shared/report/report-envelope'
import english from '../../omk_ui/locales/en.json'
import french from '../../omk_ui/locales/fr.json'
import { createClientPortsFake, type ClientPortsFake } from '../client/fakes/client-ports-fake'
import { createNuiFake } from '../client/fakes/nui-fake'
import { createFakes, type Fakes } from '../page/application/fakes'
import { createServerPortsFake, type ServerPortsFake } from '../server/fakes/server-ports-fake'

export const CHAIN_PLAYER = 2
const KIT_VERSION = '0.3.0'
const CLIENT_START_AT = 10_000
const SERVER_START_AT = 60_000
const ARTIFACT_CONVAR = 'FXServer-master v1.0.0.38435 linux'
const REPORT_REFILL_MS = 50
const SETTLE_ROUNDS_MAX = 500
const SESSION_TOKEN_FIELD = 'sessionToken'

export interface PageReply { readonly owner: string; readonly reply: Reply }

export interface Chain {
  readonly client: ClientPortsFake
  readonly server: ServerPortsFake
  readonly page: Fakes
  readonly store: UiStore
  readonly kit: ClientKit
  readonly serverKit: ServerKit
  readonly pageReplies: PageReply[]
  readonly reportsToServer: ReportEnvelope[]
  readonly replyLines: string[]
  settle(): void
  command(subcommand: OmkSubcommand, ...args: readonly string[]): readonly string[]
  holdPageMessages(type: FromPage): void
  holdReports(): void
}

interface Queues {
  readonly toPage: string[]
  readonly toClient: string[]
  readonly toServer: string[]
  readonly toClientKit: string[]
  readonly heldPageTypes: Set<string>
  readonly heldFlows: Set<HeldFlow>
  readonly sessionTokens: string[]
}

const HeldFlow = { Reports: 'reports' } as const
type HeldFlow = ValueOf<typeof HeldFlow>

function roundTrip<Value>(value: Value): string {
  return JSON.stringify(value)
}

function forwardingNui(queues: Queues): NuiPort & ReturnType<typeof createNuiFake> {
  const recorder = createNuiFake()
  return {
    ...recorder,
    send(message) {
      recorder.send(message)
      queues.toPage.push(roundTrip(message))
    },
    sendBoot(message, sessionToken) {
      recorder.sendBoot(message, sessionToken)
      queues.sessionTokens.push(sessionToken)
      queues.toPage.push(roundTrip({ ...message, [SESSION_TOKEN_FIELD]: sessionToken }))
    },
  }
}

function forwardingServerChannel(queues: Queues, reports: ReportEnvelope[]): ServerChannel & { readonly reports: readonly ReportEnvelope[] } {
  return {
    report(envelope) {
      reports.push(envelope)
      if (!queues.heldFlows.has(HeldFlow.Reports)) queues.toServer.push(roundTrip(envelope))
    },
    reports,
  }
}

function forwardingClientChannel(queues: Queues, recorder: ServerPortsFake['clients']): ClientChannel & ServerPortsFake['clients'] {
  return {
    ...recorder,
    send(target, command) {
      recorder.send(target, command)
      if (target === CHAIN_PLAYER || target === ALL_CLIENTS) queues.toClientKit.push(roundTrip(command))
    },
  }
}

function serverPorts(queues: Queues): ServerPortsFake {
  const ports = createServerPortsFake([CHAIN_PLAYER], SERVER_START_AT)
  ports.locales.setBundle('fr', { language: 'fr', messages: french })
  ports.locales.setBundle('en', { language: 'en', messages: english })
  ports.convars.set('version', ARTIFACT_CONVAR)
  return { ...ports, clients: forwardingClientChannel(queues, ports.clients) }
}

function pageStore(queues: Queues, page: Fakes): UiStore {
  return createUiStore({ ...page.ports, host: { send: (message) => void queues.toClient.push(roundTrip(message)), listen: (listener) => page.ports.host.listen(listener) } })
}

function withoutToken(json: string): ToPageMessage {
  const message = Object.entries(JSON.parse(json) as Record<string, unknown>).filter(([field]) => field !== SESSION_TOKEN_FIELD)
  return Object.fromEntries(message) as unknown as ToPageMessage
}

function recordPageReplies(message: FromPageMessage, pageReplies: PageReply[]): void {
  if (message.type !== FromPage.Event) return
  message.event.replies.forEach((owned: OwnedReply) => pageReplies.push({ owner: owned.owner, reply: owned.reply }))
}

interface Wiring {
  readonly queues: Queues
  readonly store: UiStore
  readonly page: Fakes
  readonly kit: () => ClientKit
  readonly serverKit: () => ServerKit
  readonly server: ServerPortsFake
  readonly pageReplies: PageReply[]
}

function settleOnce(wiring: Wiring): boolean {
  const { queues, store, page, server } = wiring
  const toPage = queues.toPage.shift()
  if (toPage !== undefined) store.dispatch(withoutToken(toPage))
  const toClient = queues.toClient.shift()
  if (toClient !== undefined) deliverToClient(wiring, JSON.parse(toClient) as FromPageMessage)
  const toServer = queues.toServer.shift()
  if (toServer !== undefined) {
    server.clock.advance(REPORT_REFILL_MS)
    wiring.serverKit().report(CHAIN_PLAYER, JSON.parse(toServer))
  }
  const command = queues.toClientKit.shift()
  if (command !== undefined) wiring.kit().serverCommand(JSON.parse(command) as ServerToClientCommand)
  const frame = page.frames.shift()
  frame?.()
  return [toPage, toClient, toServer, command, frame].some((step) => step !== undefined)
}

function deliverToClient(wiring: Wiring, message: FromPageMessage): void {
  if (wiring.queues.heldPageTypes.has(message.type)) return
  recordPageReplies(message, wiring.pageReplies)
  wiring.kit().pageMessage(message.type, { ...message, [SESSION_TOKEN_FIELD]: wiring.queues.sessionTokens.at(-1) ?? '' })
}

function settle(wiring: Wiring): void {
  for (let round = 0; round < SETTLE_ROUNDS_MAX; round += 1) {
    if (!settleOnce(wiring)) return
  }
  throw new Error('the chain never settled')
}

export function createChain(): Chain {
  const queues: Queues = { toPage: [], toClient: [], toServer: [], toClientKit: [], heldPageTypes: new Set(), heldFlows: new Set(), sessionTokens: [] }
  const reportsToServer: ReportEnvelope[] = []
  const replyLines: string[] = []
  const pageReplies: PageReply[] = []
  const base = createClientPortsFake(CLIENT_START_AT)
  const client: ClientPortsFake = { ...base, nui: forwardingNui(queues), server: forwardingServerChannel(queues, reportsToServer) }
  const server = serverPorts(queues)
  const page = createFakes()
  const store = pageStore(queues, page)
  const kit = createClientKit(client, DEFAULT_CONFIG, KIT_VERSION)
  const serverKit = createServerKit(server, KIT_VERSION)
  const wiring: Wiring = { queues, store, page, server, pageReplies, kit: () => kit, serverKit: () => serverKit }
  serverKit.started()
  queues.toClient.push(roundTrip({ type: FromPage.Ready }))
  settle(wiring)
  return {
    client,
    server,
    page,
    store,
    kit,
    serverKit,
    pageReplies,
    reportsToServer,
    replyLines,
    settle: () => settle(wiring),
    command(subcommand, ...args) {
      const lines: string[] = []
      serverKit.command(subcommand, args, (line) => {
        lines.push(line)
        replyLines.push(line)
      })
      settle(wiring)
      return lines
    },
    holdPageMessages: (type) => void queues.heldPageTypes.add(type),
    holdReports: () => void queues.heldFlows.add(HeldFlow.Reports),
  }
}
