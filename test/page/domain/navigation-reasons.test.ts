import { CloseReason } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { closeAllFrames } from '../../../src/page/domain/navigation'
import { closedReplies, stackOfDepth } from './navigation-helpers'

const DEPTH = 3

describe('closeAllFrames reason', () => {
  it('closes every frame with CloseAll by default', () => {
    const { replies } = closeAllFrames(stackOfDepth(DEPTH))
    expect(closedReplies(replies).map((reply) => reply.reason)).toEqual([CloseReason.CloseAll, CloseReason.CloseAll, CloseReason.CloseAll])
  })

  it('closes every frame from the top with RadialSelection for a radial selection', () => {
    const { state, replies } = closeAllFrames(stackOfDepth(DEPTH), CloseReason.RadialSelection)
    expect(state.stack).toEqual([])
    expect(closedReplies(replies).map((reply) => [reply.panelId, reply.reason])).toEqual([
      ['whitelist/level-2', CloseReason.RadialSelection],
      ['whitelist/level-1', CloseReason.RadialSelection],
      ['whitelist/level-0', CloseReason.RadialSelection],
    ])
  })
})
