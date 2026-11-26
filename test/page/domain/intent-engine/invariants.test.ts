import { CloseReason, PANEL_MAX_ITEMS, ReplyKind, STACK_MAX_DEPTH, type Item } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { BOOT_PANEL_SCAN_MAX } from '../../../../src/page/domain/command-fallback'
import { BACK_HOLD_MS } from '../../../../src/page/domain/hold-detector'
import { transition } from '../../../../src/page/domain/intent-engine'
import { PageCommandType, TimerKind, type UiCommand } from '../../../../src/page/domain/page-commands'
import { LayerKind, type UiState } from '../../../../src/page/domain/ui-state'
import { Intent } from '../../../../src/protocol/intents'
import { fromPageStackSnapshot, type OwnedReply, type PageEvent } from '../../../../src/protocol/stack'
import { ToPage } from '../../../../src/protocol/to-page'
import { FixtureOwner, OWNED_GARAGE_RADIAL_ENTRY, OWNED_LIST_PANEL, OWNED_WHITELIST_RADIAL_ENTRY } from '../../../fixtures/owned'
import { confirmFor, menuPanel } from '../navigation-helpers'
import { bootWith, events, initial, NOW, OPEN_RADIAL, openPanel, press, pushPanel, radialEntries, release, timerFired } from './engine-helpers'

const RANDOM_STEPS = 3000
const PANEL_POOL = 10
const CONFIRM_POOL = 3
const STEP_MS = 150
const PARK_MILLER_MULTIPLIER = 48_271
const PARK_MILLER_MODULUS = 2_147_483_647
const SEED = 20_261_127
const WARMUP_PASSES = 5
const MEASURED_PASSES = 20
const BOOT_BUDGET_MS = 500
const HOSTILE_PANELS = 100_000
const ACTION_ITEM_ID = 'add'
const ESCAPE_EVERY = 2

type Balance = ReadonlyMap<string, number>
interface Draw { readonly state: UiState; readonly random: number; readonly seq: number }

const nextRandom = (seed: number): number => (seed * PARK_MILLER_MULTIPLIER) % PARK_MILLER_MODULUS
const ownerOf = (random: number): string => (random % PANEL_POOL === 0 ? FixtureOwner.Garage : FixtureOwner.Whitelist)
const topId = (state: UiState): string => state.stack[state.stack.length - 1]?.panel?.panel.id ?? ''

const RANDOM_COMMANDS: readonly ((draw: Draw) => UiCommand)[] = [
  ({ random, seq }) => openPanel(menuPanel(`panel-${String(random % PANEL_POOL)}`, ownerOf(random)), seq),
  ({ state, random, seq }) => pushPanel(menuPanel(`panel-${String(random % PANEL_POOL)}`, ownerOf(random)), topId(state), seq),
  ({ state, random, seq }) => pushPanel(menuPanel(`panel-${String(random % PANEL_POOL)}`), topId(state), seq),
  ({ state, random, seq }) => ({ type: ToPage.ClosePanel, commandSeq: seq, panelId: state.stack[random % Math.max(state.stack.length, 1)]?.panel?.panel.id ?? 'whitelist/none' }),
  ({ random, seq }) => ({ type: ToPage.ShowConfirm, commandSeq: seq, confirm: confirmFor(ownerOf(random), `confirm-${String(random % CONFIRM_POOL)}`) }),
  ({ random, seq }) => openPanel(menuPanel(`panel-${String(random % PANEL_POOL)}`), seq - 1),
  () => radialEntries([OWNED_WHITELIST_RADIAL_ENTRY, OWNED_GARAGE_RADIAL_ENTRY]),
  () => OPEN_RADIAL,
  () => press(Intent.Confirm),
  () => press(Intent.Right),
  ({ random }) => press(Intent.Back, random % ESCAPE_EVERY === 0),
  () => release(Intent.Back),
  () => timerFired(TimerKind.BackHold),
  () => timerFired(TimerKind.WaitingTimeout),
  () => ({ type: PageCommandType.WindowBlurred }),
  () => ({ type: PageCommandType.WindowFocused }),
  () => ({ type: PageCommandType.ClickItem, itemId: ACTION_ITEM_ID }),
]

function shownConfirms(state: UiState): readonly string[] {
  return state.stack.flatMap((frame) => frame.layers.flatMap((layer) => (layer.kind === LayerKind.Confirm && layer.confirmId !== null ? [layer.confirmId] : [])))
}

function openedBy(state: UiState, command: UiCommand): string | null {
  const isNewer = 'commandSeq' in command && Number.isSafeInteger(command.commandSeq) && command.commandSeq > state.appliedCommandSeq
  if (!isNewer) return null
  if (command.type === ToPage.OpenPanel || command.type === ToPage.PushPanel) return command.panel.panel.id
  const isNewConfirm = command.type === ToPage.ShowConfirm && !shownConfirms(state).includes(command.confirm.confirm.id)
  return isNewConfirm ? command.confirm.confirm.id : null
}

function settled(balance: Balance, opened: string | null, replies: readonly OwnedReply[]): Balance {
  const next = new Map(balance)
  if (opened !== null) next.set(opened, (next.get(opened) ?? 0) + 1)
  replies.forEach(({ reply }) => {
    if (reply.kind === ReplyKind.PanelClosed) next.set(reply.panelId, (next.get(reply.panelId) ?? 0) - 1)
    if (reply.kind === ReplyKind.ConfirmAnswered) next.set(reply.confirmId, (next.get(reply.confirmId) ?? 0) - 1)
  })
  return next
}

function expectNoReplyAfterClose(event: PageEvent): void {
  const closed = new Set<string>()
  event.replies.forEach(({ reply }) => {
    if (reply.kind === ReplyKind.ItemSelected || reply.kind === ReplyKind.ValueChanged || reply.kind === ReplyKind.FormSubmitted || reply.kind === ReplyKind.PanelClosed) {
      expect(closed.has(reply.panelId)).toBe(false)
      if (reply.kind === ReplyKind.PanelClosed) closed.add(reply.panelId)
    }
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
  it('answers each opening and each confirmation exactly once over random commands', () => {
    let state = initial()
    let balance: Balance = new Map()
    let random = SEED
    const reasons = new Set<string>()
    for (let step = 1; step <= RANDOM_STEPS; step += 1) {
      random = nextRandom(random)
      const command = RANDOM_COMMANDS[random % RANDOM_COMMANDS.length]?.({ state, random: Math.floor(random / RANDOM_COMMANDS.length), seq: step }) ?? OPEN_RADIAL
      const next = transition(state, command, NOW + step * STEP_MS + (random % BACK_HOLD_MS))
      const stepEvents = events(next.effects)
      expect(stepEvents.length).toBeLessThanOrEqual(1)
      stepEvents.forEach((event) => {
        expectNoReplyAfterClose(event)
        if (event.stack !== null) expect(fromPageStackSnapshot(event.stack)).not.toBeNull()
      })
      const stepReplies = stepEvents.flatMap((event) => event.replies)
      stepReplies.forEach(({ reply }) => reasons.add(reply.kind === ReplyKind.PanelClosed ? reply.reason : reply.kind))
      balance = settled(balance, openedBy(state, command), stepReplies)
      state = next.state
      expectBalanced(state, balance)
    }
    expect([...reasons].sort()).toEqual([...Object.values(CloseReason).filter((reason) => reason !== CloseReason.Back && reason !== CloseReason.KitStopped), ReplyKind.ConfirmAnswered, ReplyKind.RadialSelected].sort())
  })
})

describe('Boot worst cases', () => {
  it('rebuilds the largest Boot well within budget', () => {
    const items: readonly Item[] = Array.from({ length: PANEL_MAX_ITEMS }, (_, index) => ({ ...OWNED_LIST_PANEL.panel.items[1], id: `item-${String(index)}` }) as Item)
    const panels = Array.from({ length: BOOT_PANEL_SCAN_MAX }, (_, index) => menuPanel(`level-${String(index)}`, FixtureOwner.Whitelist, items))
    const boot = bootWith({ panels })
    for (let pass = 0; pass < WARMUP_PASSES; pass += 1) transition(initial(), boot, NOW)
    const startedAt = performance.now()
    for (let pass = 0; pass < MEASURED_PASSES; pass += 1) transition(initial(), boot, NOW)
    const elapsed = performance.now() - startedAt
    expect(elapsed).toBeLessThan(BOOT_BUDGET_MS)
  })

  it('reads only a bounded number of panels from a hostile Boot', () => {
    const panels = Array.from({ length: HOSTILE_PANELS }, (_, index) => menuPanel(`hostile-${String(index)}`))
    const next = transition(initial(), bootWith({ panels }), NOW)
    expect(next.state.stack).toHaveLength(STACK_MAX_DEPTH)
    expect(events(next.effects)[0]?.replies).toHaveLength(BOOT_PANEL_SCAN_MAX - STACK_MAX_DEPTH)
  })
})
