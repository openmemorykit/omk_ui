import { RejectionReason, type RejectedEvent } from '@openmemorykit/core/shared'
import { CommandKind, type ServerToClientCommand } from '../../shared/net/net-events'
import { ReportKind } from '../../shared/report/report-kind'
import { askQuestion } from './ask'
import { closeEverything } from './close-everything'
import { sendConsoleIntents } from './console-intents'
import { playDemo } from './demos/play-demo'
import { printLimitedLine } from './limited-console'
import { receiveServerNotification } from './notify-inbox'
import { requestSnapshot } from './snapshot'
import { switchTrace } from './switch-trace'
import { ONE_LINE_PER_MINUTE_MS, traceLimited } from './trace'
import type { UseCaseContext } from './use-case-context'

export function receiveServerCommand(context: UseCaseContext, command: ServerToClientCommand): void {
  switch (command.kind) {
    case CommandKind.Trace:
      switchTrace(context.ports, context.store, command.active)
      return
    case CommandKind.Notify:
      receiveServerNotification(context, command.notification)
      return
    case CommandKind.Snapshot:
      requestSnapshot(context, command.requestId)
      return
    case CommandKind.Demo:
      playDemo(context, command.demo)
      return
    case CommandKind.Intent:
      sendConsoleIntents(context, command.intent, command.count)
      return
    case CommandKind.Close:
      closeEverything(context)
      return
    case CommandKind.Ask:
      askQuestion(context, command.askId, command.text)
      return
  }
}

export function refuseServerEvent(context: UseCaseContext, rejected: RejectedEvent): void {
  const { ports, store } = context
  if (rejected.reason === RejectionReason.Shape) {
    printLimitedLine(context, `${RejectionReason.Shape}:${rejected.name}`, ONE_LINE_PER_MINUTE_MS, `unreadable server event ${rejected.name} ignored`)
    return
  }
  traceLimited(ports, store, { at: ports.clock.now(), kind: ReportKind.ForgedCall, data: { call: rejected.name } }, `${ReportKind.ForgedCall}:${rejected.name}`, ONE_LINE_PER_MINUTE_MS)
}
