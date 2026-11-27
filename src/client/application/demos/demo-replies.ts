import { ReplyKind, type Reply } from '@openmemorykit/ui/contract'
import { ReportKind } from '../../../shared/report/report-kind'
import { traceAskAnswer } from '../ask'
import type { OwnerReplyPort } from '../ports'
import { traceLine } from '../trace'
import type { UseCaseContext } from '../use-case-context'
import { ASK_OWNER, DEMO_OWNERS } from './demo-catalog'
import { openScenarioOfSelectedEntry } from './play-demo'

export type DemoReplyAnswer = (owner: string, reply: Reply) => void

export function answerDemoReply(context: UseCaseContext, owner: string, reply: Reply): void {
  if (owner === ASK_OWNER) {
    traceAskAnswer(context, reply)
    return
  }
  traceLine(context.ports, context.store, { at: context.ports.clock.now(), kind: ReportKind.DemoReply, data: { owner, reply: reply.kind } })
  if (reply.kind === ReplyKind.RadialSelected) openScenarioOfSelectedEntry(context, owner)
}

export function divertDemoReplies(replies: OwnerReplyPort, answerDemo: DemoReplyAnswer): OwnerReplyPort {
  return {
    deliver(owner, reply) {
      if (!DEMO_OWNERS.has(owner)) return replies.deliver(owner, reply)
      answerDemo(owner, reply)
      return true
    },
  }
}
