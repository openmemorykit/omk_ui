import { ReplyKind, STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import { expect } from 'vitest'
import { BACK_HOLD_MS } from '../../../../src/page/domain/hold-detector'
import { transition } from '../../../../src/page/domain/intent-engine'
import type { UiCommand } from '../../../../src/page/domain/page-commands'
import type { UiState } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { fromPageStackSnapshot, type PageEvent } from '../../../../src/protocol/stack'
import { events, initial, NOW, OPEN_RADIAL, sentOf } from './engine-helpers'
import { droppedOwner, isTyping, openedBy, settled, shownConfirms, type Balance, type Draw } from './invariant-steps'

export interface LoopResult {
  readonly reasons: ReadonlySet<string>
  readonly textEntriesOn: number
  readonly textEntriesOff: number
}

const STEP_MS = 150
const PARK_MILLER_MULTIPLIER = 48_271
const PARK_MILLER_MODULUS = 2_147_483_647

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

function expectTextEntries(before: UiState, after: UiState, actives: readonly boolean[]): void {
  const ended = isTyping(before) && !isTyping(after)
  const started = !isTyping(before) && isTyping(after)
  expect(actives.filter((active) => !active)).toEqual(ended ? [false] : [])
  expect(actives.filter((active) => active).length).toBeLessThanOrEqual(started ? 1 : 0)
}

export function runInvariantLoop(commands: readonly ((draw: Draw) => UiCommand)[], steps: number, seed: number): LoopResult {
  let state = initial()
  let balance: Balance = new Map()
  let random = seed
  const reasons = new Set<string>()
  let textEntriesOn = 0
  let textEntriesOff = 0
  for (let step = 1; step <= steps; step += 1) {
    random = nextRandom(random)
    const draw = { state, random: Math.floor(random / commands.length), seq: step }
    const command = commands[random % commands.length]?.(draw) ?? OPEN_RADIAL
    const next = transition(state, command, NOW + step * STEP_MS + (random % BACK_HOLD_MS))
    const stepEvents = events(next.effects)
    expect(stepEvents.length).toBeLessThanOrEqual(1)
    stepEvents.forEach((event) => {
      expectNoReplyAfterClose(event)
      if (event.stack !== null) expect(fromPageStackSnapshot(event.stack)).not.toBeNull()
    })
    const actives = sentOf(next.effects, FromPage.TextEntry).map((message) => message.active)
    expectTextEntries(state, next.state, actives)
    textEntriesOn += actives.filter((active) => active).length
    textEntriesOff += actives.filter((active) => !active).length
    const stepReplies = stepEvents.flatMap((event) => event.replies)
    stepReplies.forEach(({ reply }) => reasons.add(reply.kind === ReplyKind.PanelClosed ? reply.reason : reply.kind))
    balance = settled(balance, openedBy(state, command), droppedOwner(state, command), stepReplies)
    state = next.state
    expectBalanced(state, balance)
  }
  return { reasons, textEntriesOn, textEntriesOff }
}
