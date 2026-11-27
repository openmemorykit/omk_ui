import { describe, expect, it } from 'vitest'
import { ReplyKind } from '@openmemorykit/ui/contract'
import type { Reply } from '@openmemorykit/ui/contract'
import { FixtureOwner } from '../../fixtures/owned'
import { createOwnerReplyFake } from './owner-reply-fake'

const REPLY: Reply = { kind: ReplyKind.RadialSelected, entryId: 'main' }

describe('OwnerReplyPort fake', () => {
  it('delivers to every owner until one is refused, then reports the refusal', () => {
    const replies = createOwnerReplyFake()
    expect(replies.deliver(FixtureOwner.Garage, REPLY)).toBe(true)
    replies.refuseOwner(FixtureOwner.Whitelist)
    expect(replies.deliver(FixtureOwner.Whitelist, REPLY)).toBe(false)
    expect(replies.attempts.map((attempt) => attempt.owner)).toStrictEqual([FixtureOwner.Garage, FixtureOwner.Whitelist])
    expect(replies.delivered).toStrictEqual([{ owner: FixtureOwner.Garage, reply: REPLY }])
  })
})
