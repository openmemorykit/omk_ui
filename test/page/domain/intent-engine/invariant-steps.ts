import { FormOutcome, ReplyKind } from '@openmemorykit/ui/contract'
import { PageCommandType, TimerKind, type UiCommand } from '../../../../src/page/domain/page-commands'
import { LayerKind, type UiState } from '../../../../src/page/domain/ui-state'
import { Intent } from '../../../../src/protocol/intents'
import { splitNamespacedId } from '../../../../src/protocol/namespaced-id'
import type { OwnedReply } from '../../../../src/protocol/stack'
import { ToPage } from '../../../../src/protocol/to-page'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_GARAGE_RADIAL_ENTRY, OWNED_WHITELIST_RADIAL_ENTRY } from '../../../fixtures/owned'
import { confirmFor, menuPanel } from '../navigation-helpers'
import { bootWith, OPEN_RADIAL, openPanel, press, pushPanel, radialEntries, release, throwingConfirm, throwingPanel, timerFired } from './engine-helpers'
import { FakeItem } from './fake-panel-handlers'

export type Balance = ReadonlyMap<string, number>
export interface Draw { readonly state: UiState; readonly random: number; readonly seq: number }

const PANEL_POOL = 10
const CONFIRM_POOL = 3
const EVEN = 2
const STICK_REACH = 1

const ownerOf = (random: number): string => (random % PANEL_POOL === 0 ? FixtureOwner.Garage : FixtureOwner.Whitelist)
const topOf = (state: UiState): UiState['stack'][number] | undefined => state.stack[state.stack.length - 1]
const topId = (state: UiState): string => topOf(state)?.panel?.panel.id ?? ''
const panelName = (random: number): string => `panel-${String(random % PANEL_POOL)}`
const formPanel = (random: number): typeof OWNED_ADD_PANEL => ({ owner: FixtureOwner.Whitelist, panel: { ...OWNED_ADD_PANEL.panel, id: `whitelist/form-${String(random % PANEL_POOL)}` } })

export function shownConfirms(state: UiState): readonly string[] {
  return state.stack.flatMap((frame) => frame.layers.flatMap((layer) => (layer.kind === LayerKind.Confirm && layer.confirmId !== null ? [layer.confirmId] : [])))
}

export function isTyping(state: UiState): boolean {
  return !state.paused && (topOf(state)?.layers.some((layer) => layer.kind === LayerKind.Keyboard) ?? false)
}

function newConfirm(draw: Draw, throwing: boolean): UiCommand {
  if (shownConfirms(draw.state).length > 0) return { type: PageCommandType.FrameTick }
  const confirm = confirmFor(ownerOf(draw.random), `confirm-${String(draw.random % CONFIRM_POOL)}`)
  return { type: ToPage.ShowConfirm, commandSeq: draw.seq, confirm: throwing ? throwingConfirm(confirm) : confirm }
}

function bootFromStack({ state, random, seq }: Draw): UiCommand {
  const shown = shownConfirms(state)[0]
  const parts = shown === undefined ? null : splitNamespacedId(shown)
  const confirm = parts === null ? null : confirmFor(parts.owner, parts.localId)
  const panels = state.stack.flatMap((frame) => (frame.panel === null ? [] : [frame.panel]))
  return random % EVEN === 0 ? bootWith({ panels, confirm, commandSeq: seq }) : bootWith({ panels, confirm, commandSeq: seq, locale: null as never })
}

function resolveTopForm({ state, random }: Draw): UiCommand {
  const top = topOf(state)
  const result = random % EVEN === 0 ? { outcome: FormOutcome.Accepted } : { outcome: FormOutcome.Accepted, keepOpen: true }
  return { type: ToPage.ResolveForm, panelId: topId(state), submissionId: top?.form?.submissionId ?? 0, result }
}

export const RANDOM_COMMANDS: readonly ((draw: Draw) => UiCommand)[] = [
  ({ random, seq }) => openPanel(menuPanel(panelName(random), ownerOf(random)), seq),
  ({ state, random, seq }) => pushPanel(menuPanel(panelName(random), ownerOf(random)), topId(state), seq),
  ({ state, random, seq }) => pushPanel(formPanel(random), topId(state), seq),
  ({ state, random, seq }) => ({ type: ToPage.ClosePanel, commandSeq: seq, panelId: state.stack[random % Math.max(state.stack.length, 1)]?.panel?.panel.id ?? 'whitelist/none' }),
  (draw) => newConfirm(draw, false),
  (draw) => newConfirm(draw, true),
  ({ random, seq }) => openPanel(menuPanel(panelName(random)), seq - 1),
  ({ random, seq }) => openPanel(throwingPanel(`thrown-${panelName(random)}`), seq),
  ({ random, seq }) => ({ type: ToPage.DropOwner, commandSeq: seq, owner: ownerOf(random) }),
  bootFromStack,
  resolveTopForm,
  () => radialEntries([OWNED_WHITELIST_RADIAL_ENTRY, OWNED_GARAGE_RADIAL_ENTRY]),
  () => OPEN_RADIAL,
  () => press(Intent.Confirm),
  () => press(Intent.Right),
  () => press(Intent.Radial),
  ({ random }) => ({ type: ToPage.Stick, x: 0, y: random % EVEN === 0 ? STICK_REACH : -STICK_REACH }),
  ({ random }) => press(Intent.Back, random % EVEN === 0),
  () => release(Intent.Back),
  () => timerFired(TimerKind.BackHold),
  () => timerFired(TimerKind.WaitingTimeout),
  () => ({ type: PageCommandType.WindowBlurred }),
  () => ({ type: PageCommandType.WindowFocused }),
  () => ({ type: PageCommandType.ClickItem, itemId: FakeItem.Submit }),
  () => ({ type: PageCommandType.ClickItem, itemId: FakeItem.Type }),
  () => ({ type: PageCommandType.ClickItem, itemId: FakeItem.Throw }),
]

export function openedBy(state: UiState, command: UiCommand): string | null {
  const isNewer = 'commandSeq' in command && Number.isSafeInteger(command.commandSeq) && command.commandSeq > state.appliedCommandSeq
  if (!isNewer) return null
  if (command.type === ToPage.OpenPanel || command.type === ToPage.PushPanel) return command.panel.panel.id
  const isNewConfirm = command.type === ToPage.ShowConfirm && !shownConfirms(state).includes(command.confirm.confirm.id)
  return isNewConfirm ? command.confirm.confirm.id : null
}

export function droppedOwner(state: UiState, command: UiCommand): string | null {
  const isNewer = command.type === ToPage.DropOwner && Number.isSafeInteger(command.commandSeq) && command.commandSeq > state.appliedCommandSeq
  return isNewer ? command.owner : null
}

export function settled(balance: Balance, opened: string | null, dropped: string | null, replies: readonly OwnedReply[]): Balance {
  const next = new Map([...balance].filter(([instanceId]) => dropped === null || splitNamespacedId(instanceId)?.owner !== dropped))
  if (opened !== null) next.set(opened, (next.get(opened) ?? 0) + 1)
  replies.forEach(({ reply }) => {
    if (reply.kind === ReplyKind.PanelClosed) next.set(reply.panelId, (next.get(reply.panelId) ?? 0) - 1)
    if (reply.kind === ReplyKind.ConfirmAnswered) next.set(reply.confirmId, (next.get(reply.confirmId) ?? 0) - 1)
  })
  return next
}
