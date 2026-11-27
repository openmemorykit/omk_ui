import { hasOwnKey, isRecord } from '@openmemorykit/core/shared'
import { CloseReason, ReplyKind, ReplySchema } from '@openmemorykit/ui/contract'
import * as v from 'valibot'
import { FromPage, type FromPageMessageOf } from '../../protocol/from-page'
import { namespaceId } from '../../protocol/namespaced-id'
import type { LocalReply } from '../../protocol/owned'
import { receivePageEvent, type ReceivedPageEvent } from '../../protocol/page-event'
import { isCommandSeq, type PageEvent, type StackSnapshot } from '../../protocol/stack'
import { ReportKind } from '../../shared/report/report-kind'
import { closedByPlayer } from '../domain/open-blockers'
import { reconcileStack, settleConfirm } from '../domain/owner-registry'
import { printLimitedLine } from './limited-console'
import { deliverReplies } from './owner-replies'
import { forceBoot } from './page-link'
import { panelsKeptAfterSnapshot } from './panels-on-page'
import { reserveForSelectedOwner } from './reservation'
import { ONE_LINE_PER_MINUTE_MS, traceLine } from './trace'
import { rememberLink, type UseCaseContext } from './use-case-context'

const EVENT_FIELD = 'event' satisfies keyof FromPageMessageOf<typeof FromPage.Event>

function readEvent(body: unknown): ReceivedPageEvent | null {
  if (!isRecord(body) || !hasOwnKey(body, EVENT_FIELD)) return null
  return receivePageEvent(body[EVENT_FIELD] as PageEvent)
}

function refuseStackSnapshot(context: UseCaseContext, snapshot: StackSnapshot): void {
  const appliedSeq: unknown = snapshot.appliedCommandSeq
  const predatesBoot = isCommandSeq(appliedSeq) && appliedSeq < context.memory.read().bootCommandSeq
  if (!predatesBoot) forceBoot(context)
}

function applyStackSnapshot(context: UseCaseContext, snapshot: StackSnapshot | null): boolean {
  if (snapshot === null) return true
  const { ports, store } = context
  const session = store.read()
  const registry = reconcileStack(session.registry, snapshot)
  if (registry === session.registry) {
    refuseStackSnapshot(context, snapshot)
    return false
  }
  store.write({ ...session, registry })
  rememberLink(context, { panelsOnPage: panelsKeptAfterSnapshot(context.memory.read().panelsOnPage, registry, snapshot) })
  const panels = registry.stack.map((registered) => namespaceId(registered.owner, registered.panel.id))
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.StackChanged, data: { appliedCommandSeq: snapshot.appliedCommandSeq, panels } })
  return true
}

function isClosedByPlayer(reason: CloseReason, emptiedStack: boolean): boolean {
  return reason === CloseReason.CloseAll || (reason === CloseReason.Back && emptiedStack)
}

function settleReply(context: UseCaseContext, { owner, reply }: LocalReply, emptiedStack: boolean): void {
  const session = context.store.read()
  switch (reply.kind) {
    case ReplyKind.ConfirmAnswered:
      context.store.write({ ...session, registry: settleConfirm(session.registry, owner, reply.confirmId) })
      return
    case ReplyKind.PanelClosed:
      if (isClosedByPlayer(reply.reason, emptiedStack)) context.store.write({ ...session, gate: closedByPlayer(session.gate, context.ports.clock.now()) })
      return
    case ReplyKind.RadialSelected:
      reserveForSelectedOwner(context, owner)
      return
    default:
      return
  }
}

export function applyPageEvent(context: UseCaseContext, body: unknown): void {
  const received = readEvent(body)
  if (received === null) {
    printLimitedLine(context, FromPage.Event, ONE_LINE_PER_MINUTE_MS, 'unreadable page event ignored')
    return
  }
  if (!applyStackSnapshot(context, received.stack)) return
  const replies = received.replies.filter((owned) => v.is(ReplySchema, owned.reply))
  const unread = received.unreadReplies + received.replies.length - replies.length
  if (unread > 0) printLimitedLine(context, ReportKind.ReplyUndelivered, ONE_LINE_PER_MINUTE_MS, `unreadable page replies ignored: ${unread}`)
  const emptiedStack = received.stack !== null && received.stack.entries.length === 0
  replies.forEach((owned) => settleReply(context, owned, emptiedStack))
  deliverReplies(context, replies)
}
