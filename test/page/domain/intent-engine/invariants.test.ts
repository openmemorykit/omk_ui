import { CloseReason, ReplyKind, STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import { describe, expect, it, vi } from 'vitest'
import { BACK_HOLD_MS } from '../../../../src/page/domain/hold-detector'
import { transition } from '../../../../src/page/domain/intent-engine'
import type { UiState } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { fromPageStackSnapshot, type PageEvent } from '../../../../src/protocol/stack'
import { events, initial, NOW, OPEN_RADIAL, sentOf } from './engine-helpers'
import { droppedOwner, isTyping, openedBy, RANDOM_COMMANDS, settled, shownConfirms, type Balance } from './invariant-steps'

vi.mock('../../../../src/page/domain/panel-handlers', async () => {
  const fakes = await import('./fake-panel-handlers')
  return { handleList: fakes.fakeList, handleKeyboardLayer: fakes.fakeKeyboard, handleConfirmLayer: fakes.fakeConfirm }
})

const RANDOM_STEPS = 4000
const STEP_MS = 150
const PARK_MILLER_MULTIPLIER = 48_271
const PARK_MILLER_MODULUS = 2_147_483_647
const SEED = 20_261_127

const nextRandom = (seed: number): number => (seed * PARK_MILLER_MULTIPLIER) % PARK_MILLER_MODULUS
const PANEL_REPLIES: ReadonlySet<string> = new Set([ReplyKind.ItemSelected, ReplyKind.ValueChanged, ReplyKind.FormSubmitted, ReplyKind.PanelClosed])

function expectNoReplyAfterClose(event: PageEvent): void {
  const closed = new Set<string>()
  event.replies.forEach(({ reply }) => {
    if (!PANEL_REPLIES.has(reply.kind) || !('panelId' in reply)) return
    expect(closed.has(reply.panelId)).toBe(false)
    if (reply.kind === ReplyKind.PanelClosed) closed.add(reply.panelId)
  })
}

function expectBalanced(state: UiState, balance: Balance): void {
  const open = new Set([...state.stack.flatMap((frame) => (frame.panel === null ? [] : [frame.panel.panel.id])), ...shownConfirms(state)])
  balance.forEach((count, instanceId) => {
    expect([instanceId, count]).toEqual([instanceId, open.has(instanceId) ? 1 : 0])
  })
  expect(state.stack.length).toBeLessThanOrEqual(STACK_MAX_DEPTH)
}

describe('kit invariants through transition', () => {
  it('answers each opening and each confirmation exactly once over random commands, exceptions included', () => {
    let state = initial()
    let balance: Balance = new Map()
    let random = SEED
    const reasons = new Set<string>()
    let textEntries = 0
    for (let step = 1; step <= RANDOM_STEPS; step += 1) {
      random = nextRandom(random)
      const draw = { state, random: Math.floor(random / RANDOM_COMMANDS.length), seq: step }
      const command = RANDOM_COMMANDS[random % RANDOM_COMMANDS.length]?.(draw) ?? OPEN_RADIAL
      const next = transition(state, command, NOW + step * STEP_MS + (random % BACK_HOLD_MS))
      const stepEvents = events(next.effects)
      expect(stepEvents.length).toBeLessThanOrEqual(1)
      stepEvents.forEach((event) => {
        expectNoReplyAfterClose(event)
        if (event.stack !== null) expect(fromPageStackSnapshot(event.stack)).not.toBeNull()
      })
      const ended = sentOf(next.effects, FromPage.TextEntry)
      expect(ended).toEqual(isTyping(state) && !isTyping(next.state) ? [{ type: FromPage.TextEntry, active: false }] : [])
      textEntries += ended.length
      const stepReplies = stepEvents.flatMap((event) => event.replies)
      stepReplies.forEach(({ reply }) => reasons.add(reply.kind === ReplyKind.PanelClosed ? reply.reason : reply.kind))
      balance = settled(balance, openedBy(state, command), droppedOwner(state, command), stepReplies)
      state = next.state
      expectBalanced(state, balance)
    }
    expect(textEntries).toBeGreaterThan(0)
    const expected = [...Object.values(CloseReason).filter((reason) => reason !== CloseReason.Back && reason !== CloseReason.KitStopped), ReplyKind.ConfirmAnswered, ReplyKind.RadialSelected]
    expect([...reasons].sort()).toEqual(expected.sort())
  })
})
