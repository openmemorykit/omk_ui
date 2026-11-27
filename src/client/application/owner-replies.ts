import { ReplyKind, type CloseReason, type Reply } from '@openmemorykit/ui/contract'
import type { LocalReply } from '../../protocol/owned'
import { ReportKind } from '../../shared/report/report-kind'
import { traceLine } from './trace'
import type { UseCaseContext } from './use-case-context'

function isDelivered(context: UseCaseContext, owner: string, reply: Reply): boolean {
  try {
    return context.ports.replies.deliver(owner, reply)
  } catch {
    return false
  }
}

export function deliverReplies(context: UseCaseContext, replies: readonly LocalReply[]): void {
  const { ports, store } = context
  replies.forEach(({ owner, reply }) => {
    if (!isDelivered(context, owner, reply)) traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.ReplyUndelivered, data: { owner, reply: reply.kind } })
  })
}

export function panelClosedReply(owner: string, panelId: string, reason: CloseReason): LocalReply {
  return { owner, reply: { kind: ReplyKind.PanelClosed, panelId, reason } }
}

export function declinedConfirmReply(owner: string, confirmId: string): LocalReply {
  return { owner, reply: { kind: ReplyKind.ConfirmAnswered, confirmId, confirmed: false } }
}
