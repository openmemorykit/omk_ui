import { CloseReason, ReplyKind, STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { PAGE_EVENT_MAX_REPLIES, receivePageEvent } from '../../src/protocol/page-event'
import type { OwnedReply, PageEvent } from '../../src/protocol/stack'
import { FixtureOwner } from '../fixtures/owned'
import { LOCAL_REPLIES, PAGE_REPLIES } from '../fixtures/replies'
import { SHARED_STACK_SNAPSHOT } from '../fixtures/stack'

const MILLION = 1_000_000
const HUGE_BUDGET_MS = 10

const closing = (level: number): OwnedReply => ({ owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: `whitelist/level-${level}`, reason: CloseReason.CloseAll } })
const repliesOf = (count: number): readonly OwnedReply[] => Array.from({ length: count }, (_unused, level) => closing(level))
const listClosed: OwnedReply = { owner: FixtureOwner.Whitelist, reply: PAGE_REPLIES[ReplyKind.PanelClosed] }

function measure(action: () => void): number {
  action()
  const startedAt = performance.now()
  action()
  return performance.now() - startedAt
}

describe('receivePageEvent', () => {
  it('gives the stack as sent and the replies in local ids, on a frozen list', () => {
    const received = receivePageEvent({ stack: SHARED_STACK_SNAPSHOT, replies: [listClosed] })
    expect(received).toStrictEqual({ stack: SHARED_STACK_SNAPSHOT, replies: [{ owner: FixtureOwner.Whitelist, reply: LOCAL_REPLIES[ReplyKind.PanelClosed] }], unreadReplies: 0 })
    expect(Object.isFrozen(received?.replies)).toBe(true)
  })

  it('counts the replies it cannot read and keeps the others', () => {
    const foreign: OwnedReply = { owner: FixtureOwner.Garage, reply: PAGE_REPLIES[ReplyKind.PanelClosed] }
    const received = receivePageEvent({ stack: null, replies: [foreign, listClosed] })
    expect(received?.replies).toHaveLength(1)
    expect(received?.unreadReplies).toBe(1)
  })

  it('accepts as many replies as a full stack closed with a confirmation and a final reply', () => {
    expect(PAGE_EVENT_MAX_REPLIES).toBe(STACK_MAX_DEPTH + 1 + 1)
    expect(receivePageEvent({ stack: null, replies: repliesOf(PAGE_EVENT_MAX_REPLIES) })?.replies).toHaveLength(PAGE_EVENT_MAX_REPLIES)
  })

  it('refuses an event with one reply more than the bound', () => {
    expect(receivePageEvent({ stack: null, replies: repliesOf(PAGE_EVENT_MAX_REPLIES + 1) })).toBeNull()
  })

  it('refuses a million replies without reading them', () => {
    const flood = { stack: null, replies: Array.from({ length: MILLION }, () => listClosed) }
    let received: unknown = {}
    expect(measure(() => { received = receivePageEvent(flood) })).toBeLessThan(HUGE_BUDGET_MS)
    expect(received).toBeNull()
  })

  it.each([
    ['null', null],
    ['a list', []],
    ['replies that are not a list', { stack: null, replies: { length: 1 } }],
    ['no replies', { stack: null }],
  ])('refuses %s', (_case, event) => {
    expect(receivePageEvent(event as unknown as PageEvent)).toBeNull()
  })
})
