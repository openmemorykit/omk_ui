import { createClientKit, type ClientKit } from './application/client-kit'
import { createFailureReporter } from './application/failure-reporter'
import { keyBindingTexts } from './application/key-binding-texts'
import { localeWarningLine } from './application/locale-warning-line'
import type { ClientPorts, ConsolePort } from './application/ports'
import { PAGE_SNAPSHOT_WAIT_MS } from './application/snapshot'
import { createCameraPort } from './infrastructure/camera'
import { createGameClock } from './infrastructure/clock'
import { createConfigSource } from './infrastructure/config'
import { createConsolePort } from './infrastructure/console'
import { createControlsPort } from './infrastructure/controls'
import { createClientConvars } from './infrastructure/convars'
import { registerKitExports } from './infrastructure/exports'
import { createFrameLoops } from './infrastructure/frame-loop'
import { createGameStatePort } from './infrastructure/game-state'
import { registerKeyMappings } from './infrastructure/key-mapping'
import { createGlyphStore } from './infrastructure/kvp'
import { createLocalEvents } from './infrastructure/local-events'
import { createClientLocaleSource } from './infrastructure/locales'
import { registerNuiCallbacks } from './infrastructure/nui-callbacks'
import { createNuiPort } from './infrastructure/nui'
import { createRandomSource } from './infrastructure/random'
import { createOwnerReplyPort } from './infrastructure/replies'
import { registerResourceStop } from './infrastructure/resource-stop'
import { createServerLink, type ServerLink } from './infrastructure/server-channel'
import { armTimer } from './infrastructure/timers'
import type { FromPage } from '../protocol/from-page'
import { guardedCall, type FailureHandler } from '../shared/guarded-call'
import { KIT_RESOURCE_NAME, startRefusalLine } from '../shared/kit-resource'
import { CommandKind, NetEvent, type ServerToClientCommand } from '../shared/net/net-events'

const EARLY_PAGE_MESSAGES_MAX = 16
const SNAPSHOT_TIMER_MS = PAGE_SNAPSHOT_WAIT_MS + 1

interface EarlyPageMessage {
  readonly type: FromPage
  readonly body: unknown
}

let kit: ClientKit | null = null
const earlyPageMessages: EarlyPageMessage[] = []

function receivePageMessage(type: FromPage, body: unknown): void {
  if (kit !== null) kit.pageMessage(type, body)
  else if (earlyPageMessages.length < EARLY_PAGE_MESSAGES_MAX) earlyPageMessages.push({ type, body })
}

function createPorts(link: ServerLink, console: ConsolePort, onFailure: FailureHandler): ClientPorts {
  const loops = createFrameLoops({ onPumpFrame: () => kit?.pumpFrame(), onIdleFrame: () => kit?.idleFrame(), onFailure })
  const configReading = createConfigSource(onFailure).read()
  return {
    nui: createNuiPort(onFailure),
    controls: createControlsPort(onFailure),
    camera: createCameraPort(onFailure),
    game: createGameStatePort(onFailure),
    replies: createOwnerReplyPort(onFailure),
    pump: loops.pump,
    idle: loops.idle,
    glyphs: createGlyphStore(onFailure),
    config: { read: () => configReading },
    locales: createClientLocaleSource((warning) => console.print(localeWarningLine(warning)), onFailure),
    convars: createClientConvars(),
    console,
    server: link.channel,
    events: createLocalEvents(onFailure),
    clock: createGameClock(),
    random: createRandomSource(),
  }
}

function receiveServerCommand(startedKit: ClientKit, command: ServerToClientCommand, onFailure: FailureHandler): void {
  startedKit.serverCommand(command)
  if (command.kind === CommandKind.Snapshot) armTimer(SNAPSHOT_TIMER_MS, () => startedKit.expireSnapshot(), onFailure)
}

function connectEntryPoints(startedKit: ClientKit, link: ServerLink, ports: ClientPorts, onFailure: FailureHandler): void {
  registerKitExports((name, owner, args) => startedKit.callExport(name, owner, args), onFailure)
  const texts = keyBindingTexts(ports)
  registerKeyMappings({
    radial: { description: texts.radial, onPress: () => startedKit.radialPress(), onRelease: () => startedKit.radialRelease() },
    interact: { description: texts.interact, onPress: () => startedKit.interactPress(), onRelease: () => startedKit.interactRelease() },
    glyphs: { onCommand: (args) => startedKit.glyphCommand(args), help: texts.glyphsSuggestion },
    onFailure,
  })
  link.events.onFromServer(NetEvent.Trace, (command) => receiveServerCommand(startedKit, command, onFailure))
  link.events.onFromServer(NetEvent.Notify, (command) => receiveServerCommand(startedKit, command, onFailure))
  link.events.onFromServer(NetEvent.Command, (command) => receiveServerCommand(startedKit, command, onFailure))
  registerResourceStop({ onOtherResourceStopped: (name) => startedKit.resourceStopped(name), onSelfStopping: () => startedKit.selfStopping() }, onFailure)
}

function replayEarlyPageMessages(startedKit: ClientKit, onFailure: FailureHandler): void {
  earlyPageMessages.splice(0).forEach(({ type, body }) => guardedCall(onFailure, `replay page message ${type}`, () => startedKit.pageMessage(type, body), undefined))
}

function startKit(consolePort: ConsolePort, onFailure: FailureHandler): void {
  const link = createServerLink((rejected) => kit?.serverEventRejected(rejected), onFailure)
  const ports = createPorts(link, consolePort, onFailure)
  const startedKit = createClientKit(ports, ports.config.read().config, __OMK_VERSION__)
  kit = startedKit
  connectEntryPoints(startedKit, link, ports, onFailure)
  replayEarlyPageMessages(startedKit, onFailure)
}

function start(): void {
  const resourceName = GetCurrentResourceName()
  if (resourceName !== KIT_RESOURCE_NAME) {
    console.error(startRefusalLine(resourceName))
    return
  }
  const consolePort = createConsolePort()
  const onFailure = createFailureReporter(consolePort, createGameClock())
  registerNuiCallbacks(receivePageMessage, onFailure)
  guardedCall(onFailure, 'start the client kit', () => startKit(consolePort, onFailure), undefined)
}

start()
