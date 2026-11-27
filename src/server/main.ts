import { createFivemConvarSource } from '@openmemorykit/core/server'
import { createFailureReporter } from './application/failure-reporter'
import type { ServerKit, ServerPorts } from './application/ports'
import { createServerKit } from './application/server-kit'
import { SNAPSHOT_TIMEOUT_MS } from './application/snapshot-requests'
import { createClientChannel } from './infrastructure/client-channel'
import { createServerClock } from './infrastructure/clock'
import { createConfigSource } from './infrastructure/config'
import { registerKitCommand } from './infrastructure/kit-command'
import { createServerLocaleSource } from './infrastructure/locales'
import { registerNotifyExport } from './infrastructure/notify-export'
import { registerPlayerDropped } from './infrastructure/player-dropped-event'
import { createPlayerPort } from './infrastructure/player-port'
import { registerRawReportEvent } from './infrastructure/report-event'
import { isRunningAsKit } from './infrastructure/resource-name'
import { createServerConsole } from './infrastructure/server-console'
import { createKitServerEvents } from './infrastructure/server-events'
import { armTimer } from './infrastructure/timers'
import { guardedCall, type FailureHandler } from '../shared/guarded-call'
import { startRefusalLine } from '../shared/kit-resource'

const SNAPSHOT_TIMER_MS = SNAPSHOT_TIMEOUT_MS + 1

let kit: ServerKit | null = null

function createPorts(onFailure: FailureHandler): ServerPorts {
  return {
    console: createServerConsole(),
    clients: createClientChannel(createKitServerEvents(), onFailure),
    players: createPlayerPort(),
    clock: createServerClock(),
    convars: createFivemConvarSource(),
    config: createConfigSource(onFailure),
    locales: createServerLocaleSource((warning) => kit?.localeWarning(warning), onFailure),
  }
}

function connectEntryPoints(startedKit: ServerKit, onFailure: FailureHandler): void {
  registerKitCommand({
    run: (subcommand, args, reply) => {
      startedKit.command(subcommand, args, reply)
      armTimer(SNAPSHOT_TIMER_MS, () => startedKit.flushExpired(), onFailure)
    },
    unknownSubcommand: (name, reply) => startedKit.unknownSubcommand(name, reply),
    denied: (source, reply) => startedKit.denied(source, reply),
  }, onFailure)
  registerRawReportEvent((source, raw) => startedKit.report(source, raw), onFailure)
  registerNotifyExport((target, notification, caller) => startedKit.notifyExport(target, notification, caller), onFailure)
  registerPlayerDropped((source) => startedKit.playerDropped(source), onFailure)
}

function startKit(onFailure: FailureHandler): void {
  const ports = createPorts(onFailure)
  const startedKit = createServerKit(ports, __OMK_VERSION__)
  kit = startedKit
  connectEntryPoints(startedKit, onFailure)
  startedKit.started()
}

function start(): void {
  if (!isRunningAsKit((foundName) => console.error(startRefusalLine(foundName)))) return
  const onFailure = createFailureReporter(createServerConsole(), createServerClock())
  guardedCall(onFailure, 'start the server kit', () => startKit(onFailure), undefined)
}

start()
