import { CloseReason, PANEL_MAX_ITEMS, ReplyKind, STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import {
  closeAllFrames,
  closePanelFrame,
  dropOwnerFrames,
  openPanelFrame,
  popTopFrame,
  pushPanelFrame,
  showConfirmLayer,
  updatePanelFrame,
  type StackChange,
} from '../../../src/page/domain/navigation'
import { pageEvent, stackSnapshot } from '../../../src/page/domain/page-event'
import { createInitialState, LayerKind, type UiState } from '../../../src/page/domain/ui-state'
import { FromPage } from '../../../src/protocol/from-page'
import type { OwnedConfirm, OwnedPanel } from '../../../src/protocol/owned'
import { fromPageStackSnapshot, type OwnedReply } from '../../../src/protocol/stack'
import { ADD_ACTION } from '../../fixtures/items'
import { FixtureOwner, OWNED_REMOVE_CONFIRM } from '../../fixtures/owned'
import { closedReplies, confirmFor, menuPanel, replyKinds, stackIds, stackOfDepth } from './navigation-helpers'

const RANDOM_STEPS = 2000
const PANEL_POOL = 12
const CONFIRM_POOL = 3
const PARK_MILLER_MULTIPLIER = 48_271
const PARK_MILLER_MODULUS = 2_147_483_647
const SEED = 20_261_126
const FIVE_FRAMES = 5
const TWO_FRAMES = 2
const CONFIRM_SEQ = 2
const NEXT_SEQ = 3
const LOWER_INDEX = 1
const FRACTIONAL_SEQ = 1.5
const BEYOND_SAFE = 2
const WARM_UP_RUNS = 20
const MEASURED_RUNS = 200
const UPDATE_BUDGET_MS = 500

type Balance = ReadonlyMap<string, number>

function nextRandom(seed: number): number {
  return (seed * PARK_MILLER_MULTIPLIER) % PARK_MILLER_MODULUS
}

function shownConfirmIds(state: UiState): readonly string[] {
  return state.stack.flatMap((frame) => frame.layers.flatMap((layer) => (layer.kind === LayerKind.Confirm && layer.confirmId !== null ? [layer.confirmId] : [])))
}

function answeredConfirmIds(replies: readonly OwnedReply[]): readonly string[] {
  return replies.flatMap((owned) => (owned.reply.kind === ReplyKind.ConfirmAnswered ? [owned.reply.confirmId] : []))
}

function settleConfirms(balance: Balance, before: UiState, after: UiState, replies: readonly OwnedReply[]): Balance {
  const previous = new Set(shownConfirmIds(before))
  const added = shownConfirmIds(after).filter((confirmId) => !previous.has(confirmId)).map((confirmId) => [confirmId, 1] as const)
  const answered = answeredConfirmIds(replies).map((confirmId) => [confirmId, -1] as const)
  return [...added, ...answered].reduce((current, [confirmId, delta]) => new Map([...current, [confirmId, (current.get(confirmId) ?? 0) + delta]]), balance)
}

function settle(balance: Balance, opened: string | null, replies: readonly OwnedReply[]): Balance {
  const withOpen = opened === null ? balance : new Map([...balance, [opened, (balance.get(opened) ?? 0) + 1]])
  return closedReplies(replies).reduce((current, reply) => new Map([...current, [reply.panelId, (current.get(reply.panelId) ?? 0) - 1]]), withOpen)
}

interface Draw { readonly state: UiState; readonly panel: OwnedPanel; readonly top: string; readonly someId: string; readonly confirmId: string; readonly seq: number }
interface Drawn { readonly change: StackChange; readonly opened: string | null }

const RANDOM_COMMANDS: readonly ((draw: Draw) => Drawn)[] = [
  (draw) => ({ change: openPanelFrame(draw.state, draw.panel, draw.seq), opened: draw.panel.panel.id }),
  (draw) => ({ change: pushPanelFrame(draw.state, draw.panel, draw.top, draw.seq), opened: draw.panel.panel.id }),
  (draw) => ({ change: pushPanelFrame(draw.state, draw.panel, draw.top, draw.seq), opened: draw.panel.panel.id }),
  (draw) => ({ change: closePanelFrame(draw.state, draw.someId, draw.seq), opened: null }),
  (draw) => ({ change: popTopFrame(draw.state), opened: null }),
  (draw) => ({ change: closeAllFrames(draw.state), opened: null }),
  (draw) => ({ change: { state: showConfirmLayer(draw.state, confirmFor(FixtureOwner.Whitelist, draw.confirmId), draw.seq), replies: [] }, opened: null }),
]

function randomCommand(state: UiState, random: number, seq: number): Drawn {
  const panel = menuPanel(`panel-${String(random % PANEL_POOL)}`)
  const top = state.stack[state.stack.length - 1]?.panel?.panel.id ?? ''
  const someId = state.stack[random % Math.max(state.stack.length, 1)]?.panel?.panel.id ?? 'whitelist/none'
  const command = RANDOM_COMMANDS[Math.floor(random / PANEL_POOL) % RANDOM_COMMANDS.length] ?? popTopFrameDraw
  return command({ state, panel, top, someId, confirmId: `confirm-${String(random % CONFIRM_POOL)}`, seq })
}

function popTopFrameDraw(draw: Draw): Drawn {
  return { change: popTopFrame(draw.state), opened: null }
}

describe('one PanelClosed per accepted open', () => {
  it('closes replaced, owner-closed, player-closed, discarded and closed-all panels exactly once', () => {
    const steps: readonly ((state: UiState, seq: number) => StackChange)[] = [
      (state, seq) => openPanelFrame(state, menuPanel('a'), seq),
      (state, seq) => pushPanelFrame(state, menuPanel('b'), 'whitelist/a', seq),
      (state, seq) => pushPanelFrame(state, menuPanel('c'), 'whitelist/b', seq),
      (state, seq) => pushPanelFrame(state, menuPanel('d'), 'whitelist/a', seq),
      (state, seq) => closePanelFrame(state, 'whitelist/b', seq),
      (state, seq) => closePanelFrame(state, 'whitelist/b', seq),
      (state, seq) => openPanelFrame(state, menuPanel('e'), seq),
      (state, seq) => pushPanelFrame(state, menuPanel('f'), 'whitelist/e', seq),
      (state) => popTopFrame(state),
      (state) => closeAllFrames(state),
    ]
    const replies = steps.reduce<{ readonly state: UiState; readonly replies: readonly OwnedReply[] }>(
      (run, step, index) => {
        const change = step(run.state, index + 1)
        return { state: change.state, replies: run.replies.concat(change.replies) }
      },
      { state: createInitialState(), replies: [] },
    ).replies
    const closed = closedReplies(replies).map((reply) => `${reply.panelId}:${reply.reason}`)
    expect([...closed].sort()).toEqual(
      ['a:closedByOwner', 'b:closedByOwner', 'c:closedByOwner', 'd:discarded', 'e:closeAll', 'f:back'].map((entry) => `whitelist/${entry}`),
    )
  })

  it('keeps every panel instance balanced over a long random command sequence', () => {
    const initial = { state: createInitialState(), balance: new Map<string, number>() as Balance, confirms: new Map<string, number>() as Balance, random: SEED }
    const final = Array.from({ length: RANDOM_STEPS }, (_, index) => index + 1).reduce((run, seq) => {
      const random = nextRandom(run.random)
      const { change, opened } = randomCommand(run.state, random, seq)
      const balance = settle(run.balance, opened, change.replies)
      const open = new Set(stackIds(change.state))
      balance.forEach((count, panelId) => {
        expect(count).toBe(open.has(panelId) ? 1 : 0)
      })
      const confirms = settleConfirms(run.confirms, run.state, change.state, change.replies)
      const shown = new Set(shownConfirmIds(change.state))
      confirms.forEach((count, confirmId) => {
        expect(count).toBe(shown.has(confirmId) ? 1 : 0)
      })
      expect(change.state.stack.length).toBeLessThanOrEqual(STACK_MAX_DEPTH)
      expect(fromPageStackSnapshot(stackSnapshot(change.state))).not.toBeNull()
      return { state: change.state, balance, confirms, random }
    }, initial)
    const closedAll = closeAllFrames(final.state)
    expect([...settle(final.balance, null, closedAll.replies).values()].every((count) => count === 0)).toBe(true)
    expect([...settleConfirms(final.confirms, final.state, closedAll.state, closedAll.replies).values()].every((count) => count === 0)).toBe(true)
    expect(final.confirms.size).toBe(CONFIRM_POOL)
  })
})

describe('closing below the top', () => {
  it('closes every frame above the closed panel, each with its own PanelClosed, top first', () => {
    const deep = stackOfDepth(FIVE_FRAMES)
    const { state, replies } = closePanelFrame(deep, 'whitelist/level-1', FIVE_FRAMES + 1)
    expect(stackIds(state)).toEqual(['whitelist/level-0'])
    expect(closedReplies(replies)).toEqual(['level-4', 'level-3', 'level-2', 'level-1'].map((level) => ({
      kind: ReplyKind.PanelClosed,
      panelId: `whitelist/${level}`,
      reason: CloseReason.ClosedByOwner,
    })))
  })
})

describe('destroyed confirmation', () => {
  const confirmed = (): UiState => showConfirmLayer(stackOfDepth(1), OWNED_REMOVE_CONFIRM, CONFIRM_SEQ)
  const refusal: OwnedReply = { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.ConfirmAnswered, confirmId: OWNED_REMOVE_CONFIRM.confirm.id, confirmed: false } }
  const closings: readonly [string, (state: UiState) => StackChange][] = [
    ['replaced', (state) => openPanelFrame(state, menuPanel('other'), NEXT_SEQ)],
    ['closed by its owner', (state) => closePanelFrame(state, 'whitelist/level-0', NEXT_SEQ)],
    ['popped by the player', (state) => popTopFrame(state)],
    ['closed all', (state) => closeAllFrames(state)],
  ]

  it.each(closings)('answers no before the PanelClosed of its frame when %s', (_, close) => {
    const { replies } = close(confirmed())
    expect(replies[0]).toEqual(refusal)
    expect(replyKinds(replies)).toEqual([ReplyKind.ConfirmAnswered, ReplyKind.PanelClosed])
    expect(pageEvent(null, replies)).toEqual({ type: FromPage.Event, event: { stack: null, replies } })
  })

  const refusals = (replies: readonly OwnedReply[]): readonly OwnedReply[] => replies.filter((owned) => owned.reply.kind === ReplyKind.ConfirmAnswered)

  it('answers no once when a Close below the top cuts the frame that holds the confirmation', () => {
    const covered = pushPanelFrame(confirmed(), menuPanel('level-1'), 'whitelist/level-0', NEXT_SEQ).state
    const { replies } = closePanelFrame(covered, 'whitelist/level-0', NEXT_SEQ + 1)
    expect(refusals(replies)).toEqual([refusal])
    expect(replyKinds(replies)).toEqual([ReplyKind.PanelClosed, ReplyKind.ConfirmAnswered, ReplyKind.PanelClosed])
  })

  it('answers no once when a Close below the top cuts a frame above it holding the confirmation', () => {
    const above = showConfirmLayer(stackOfDepth(TWO_FRAMES), OWNED_REMOVE_CONFIRM, NEXT_SEQ)
    const { replies } = closePanelFrame(above, 'whitelist/level-0', NEXT_SEQ + 1)
    expect(replyKinds(replies)).toEqual([ReplyKind.ConfirmAnswered, ReplyKind.PanelClosed, ReplyKind.PanelClosed])
  })

  it('answers no exactly once when several closings follow in the same Event', () => {
    const first = closePanelFrame(confirmed(), 'whitelist/level-0', NEXT_SEQ)
    const second = closeAllFrames(first.state)
    const third = popTopFrame(second.state)
    const replies = [...first.replies, ...second.replies, ...third.replies, ...first.replies]
    const message = pageEvent(null, replies)
    expect(message.type === FromPage.Event ? refusals(message.event.replies) : []).toEqual([refusal])
    expect(refusals([...first.replies, ...second.replies, ...third.replies])).toEqual([refusal])
  })

  it('answers no when an empty confirmation frame is replaced', () => {
    const confirmOnly = showConfirmLayer(createInitialState(), OWNED_REMOVE_CONFIRM, 1)
    expect(openPanelFrame(confirmOnly, menuPanel('a'), CONFIRM_SEQ).replies).toEqual([refusal])
  })
})

describe('untrusted commands', () => {
  it('keeps appliedCommandSeq a valid, increasing number whatever the command number', () => {
    const base = stackOfDepth(TWO_FRAMES)
    const numbers = [Number.NaN, -1, FRACTIONAL_SEQ, Number.POSITIVE_INFINITY, LOWER_INDEX, Number.MAX_SAFE_INTEGER + BEYOND_SAFE]
    numbers.forEach((commandSeq) => {
      const state = closePanelFrame(base, 'whitelist/unknown', commandSeq).state
      expect(state.appliedCommandSeq).toBe(base.appliedCommandSeq)
      expect(fromPageStackSnapshot(stackSnapshot(state))).not.toBeNull()
    })
  })

  it('ignores malformed panels, identifiers and confirmations without throwing', () => {
    const base = stackOfDepth(TWO_FRAMES)
    const tooMany = menuPanel('huge', FixtureOwner.Whitelist, Array.from({ length: PANEL_MAX_ITEMS + 1 }, () => ADD_ACTION))
    const malformed = [null, {}, { owner: 1, panel: {} }, { owner: 'whitelist', panel: { id: 'whitelist/x', kind: 'menu', items: 'none' } }, tooMany]
    const withNullItem = { ...menuPanel('x'), panel: { ...menuPanel('x').panel, items: [null] } }
    ;[...malformed, withNullItem].map((panel) => panel as unknown as OwnedPanel).forEach((panel) => {
      expect(openPanelFrame(base, panel, NEXT_SEQ).state.stack).toBe(base.stack)
      expect(pushPanelFrame(base, panel, 'whitelist/level-1', NEXT_SEQ)).toEqual({ state: { ...base, appliedCommandSeq: NEXT_SEQ }, replies: [] })
      expect(updatePanelFrame(base, panel)).toBe(base)
    })
    ;[undefined, null, '__proto__', 'toString'].map((panelId) => panelId as unknown as string).forEach((panelId) => {
      expect(closePanelFrame(base, panelId, NEXT_SEQ).replies).toEqual([])
      expect(dropOwnerFrames(base, panelId, NEXT_SEQ).stack).toBe(base.stack)
    })
    ;[null, { owner: 'whitelist' }, { owner: 'whitelist', confirm: { id: 'remove' } }].map((confirm) => confirm as unknown as OwnedConfirm).forEach((confirm) => {
      expect(showConfirmLayer(base, confirm, NEXT_SEQ).stack).toBe(base.stack)
    })
  })

  it('updates a full panel of a full stack within the time budget', () => {
    const items = Array.from({ length: PANEL_MAX_ITEMS }, (_, index) => ({ ...ADD_ACTION, id: `row-${String(index)}` }))
    const full = updatePanelFrame(stackOfDepth(STACK_MAX_DEPTH), menuPanel('level-7', FixtureOwner.Whitelist, items))
    const shifted = menuPanel('level-7', FixtureOwner.Whitelist, items.slice(1).reverse())
    const run = (): UiState => updatePanelFrame(full, shifted)
    Array.from({ length: WARM_UP_RUNS }).forEach(run)
    const startedAt = Date.now()
    Array.from({ length: MEASURED_RUNS }).forEach(run)
    expect(Date.now() - startedAt).toBeLessThan(UPDATE_BUDGET_MS)
  })
})
