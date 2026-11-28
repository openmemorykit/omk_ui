import type { RejectedEvent } from '@openmemorykit/core/shared'
import type { KitExport, Reply } from '@openmemorykit/ui/contract'
import type { KitConfig } from '../../shared/config/config-schema'
import type { ServerToClientCommand } from '../../shared/net/net-events'
import { cleanupOwner } from './cleanup-owner'
import { callExport, type KitQuery } from './contract-call'
import { answerDemoReply, divertDemoReplies } from './demos/demo-replies'
import { changeGlyphSet } from './glyph-set'
import { receivePageMessage } from './page-messages'
import type { ClientPorts } from './ports'
import { pumpFrame } from './pump-inputs'
import { idleFrame, radialPress, radialRelease, startIdleTick } from './radial-gesture'
import { FocusReleaseReason, releaseFocus } from './release-focus'
import { receiveServerCommand, refuseServerEvent } from './server-commands'
import { createSessionStore, INITIAL_CLIENT_SESSION } from './session-state'
import { expirePageSnapshot } from './snapshot'
import { interactPress, interactRelease } from './track-prompts'
import { createUseCaseContext } from './use-case-context'
import { watchPage } from './watch-page'

export interface ClientKit {
  callExport(name: KitExport | KitQuery, owner: string | null, args: readonly unknown[]): unknown
  radialPress(): void
  radialRelease(): void
  interactPress(): void
  interactRelease(): void
  pumpFrame(): void
  idleFrame(): void
  pageMessage(type: string, body: unknown): void
  resourceStopped(name: string): void
  selfStopping(): void
  serverCommand(command: ServerToClientCommand): void
  serverEventRejected(rejected: RejectedEvent): void
  glyphCommand(args: readonly string[]): void
  expireSnapshot(): void
}

export function createClientKit(ports: ClientPorts, config: KitConfig, version: string): ClientKit {
  const store = createSessionStore(INITIAL_CLIENT_SESSION)
  const replies = divertDemoReplies(ports.replies, answerDivertedReply)
  const context = createUseCaseContext({ ...ports, replies }, store, version)
  function answerDivertedReply(owner: string, reply: Reply): void {
    answerDemoReply(context, owner, reply)
  }
  const kitPorts = context.ports
  const { input } = config
  startIdleTick(kitPorts, input)
  return {
    callExport: (name, owner, args) => callExport(context, name, owner, args),
    radialPress: () => radialPress(kitPorts, store, input),
    radialRelease: () => radialRelease(kitPorts, store, input),
    interactPress: () => interactPress(kitPorts, store),
    interactRelease: () => interactRelease(kitPorts, store),
    pumpFrame: () => {
      pumpFrame(kitPorts, store, input)
      watchPage(context)
    },
    idleFrame: () => idleFrame(kitPorts, store, input),
    pageMessage: (type, body) => receivePageMessage(context, type, body),
    resourceStopped: (name) => cleanupOwner(context, name),
    selfStopping: () => releaseFocus(kitPorts, store, FocusReleaseReason.KitStopping),
    serverCommand: (command) => receiveServerCommand(context, command),
    serverEventRejected: (rejected) => refuseServerEvent(context, rejected),
    glyphCommand: (args) => changeGlyphSet(kitPorts, args),
    expireSnapshot: () => expirePageSnapshot(context),
  }
}
