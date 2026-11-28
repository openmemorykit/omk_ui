import { ReplyKind, type Reply } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { demoOwnerOf } from '../../../../src/client/application/demos/demo-catalog'
import { divertDemoReplies } from '../../../../src/client/application/demos/demo-replies'
import { LOCAL_REPLIES } from '../../../fixtures/replies'
import { createOwnerReplyFake } from '../../fakes/owner-reply-fake'

const LOOKALIKE_OWNER = 'omk_ui_demo_x'
const WHITELIST_DEMO_OWNER = demoOwnerOf('whitelist')
const SELECTED: Reply = LOCAL_REPLIES[ReplyKind.RadialSelected]

interface Answered {
  readonly owner: string
  readonly reply: Reply
}

function divertedPort(): { readonly real: ReturnType<typeof createOwnerReplyFake>; readonly answered: Answered[]; readonly port: ReturnType<typeof divertDemoReplies> } {
  const real = createOwnerReplyFake()
  const answered: Answered[] = []
  return { real, answered, port: divertDemoReplies(real, (owner, reply) => void answered.push({ owner, reply })) }
}

describe('divertDemoReplies', () => {
  it('answers the owners of the demo catalog without touching the real reply port', () => {
    const { real, answered, port } = divertedPort()
    expect(port.deliver(WHITELIST_DEMO_OWNER, SELECTED)).toBe(true)
    expect(answered).toStrictEqual([{ owner: WHITELIST_DEMO_OWNER, reply: SELECTED }])
    expect(real.attempts).toStrictEqual([])
  })

  it('delivers to a real resource whose name only looks like a demo owner', () => {
    const { real, answered, port } = divertedPort()
    expect(port.deliver(LOOKALIKE_OWNER, SELECTED)).toBe(true)
    expect(real.delivered).toStrictEqual([{ owner: LOOKALIKE_OWNER, reply: SELECTED }])
    expect(answered).toStrictEqual([])
  })
})
