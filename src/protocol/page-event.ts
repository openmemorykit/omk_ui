import { isRecord } from '@openmemorykit/core/shared'
import { CONFIRMS_PER_OWNER, STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import { fromPageReply, type LocalReply } from './owned'
import type { PageEvent, StackSnapshot } from './stack'

const FINAL_REPLIES = 1

export const PAGE_EVENT_MAX_REPLIES = STACK_MAX_DEPTH + CONFIRMS_PER_OWNER + FINAL_REPLIES

export interface ReceivedPageEvent {
  readonly stack: StackSnapshot | null
  readonly replies: readonly LocalReply[]
  readonly unreadReplies: number
}

const isList = (value: unknown): value is readonly unknown[] => Array.isArray(value)

export function receivePageEvent(event: PageEvent): ReceivedPageEvent | null {
  if (!isRecord(event)) return null
  const { stack, replies: sent } = event
  if (!isList(sent) || sent.length > PAGE_EVENT_MAX_REPLIES) return null
  const replies = Object.freeze(sent.flatMap((owned) => fromPageReply(owned) ?? []))
  return { stack: stack ?? null, replies, unreadReplies: sent.length - replies.length }
}
