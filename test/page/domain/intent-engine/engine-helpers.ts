import { ReplyKind, type Reply } from '@openmemorykit/ui/contract'
import { transition } from '../../../../src/page/domain/intent-engine'
import { PageCommandType, type LocalIntentCommand, type TimerKind, type UiCommand } from '../../../../src/page/domain/page-commands'
import { UiEffectType, type Transition, type UiEffect } from '../../../../src/page/domain/ui-effects'
import { createInitialState, type UiState } from '../../../../src/page/domain/ui-state'
import { FromPage, type FromPageMessage, type FromPageMessageOf } from '../../../../src/protocol/from-page'
import { InputSource, IntentPhase, type Intent } from '../../../../src/protocol/intents'
import type { OwnedConfirm, OwnedPanel, OwnedRadialEntry } from '../../../../src/protocol/owned'
import type { OwnedReply, PageEvent } from '../../../../src/protocol/stack'
import { ToPage, type ToPageMessageOf } from '../../../../src/protocol/to-page'
import { TO_PAGE_SAMPLES } from '../../../fixtures/messages'
import { FixtureOwner, OWNED_REMOVE_CONFIRM } from '../../../fixtures/owned'
import { menuPanel } from '../navigation-helpers'

export const NOW = 50_000
const FIRST_PUSH_SEQ = 2

export interface Run { readonly state: UiState; readonly effects: readonly UiEffect[] }

export function run(state: UiState, commands: readonly UiCommand[], now: number = NOW): Run {
  return commands.reduce<Run>((previous, command) => {
    const next: Transition = transition(previous.state, command, now)
    return { state: next.state, effects: previous.effects.concat(next.effects) }
  }, { state, effects: [] })
}

export function press(intent: Intent, fromEscape = false): LocalIntentCommand {
  return { type: PageCommandType.LocalIntent, intent, phase: IntentPhase.Press, fromEscape }
}

export function release(intent: Intent, fromEscape = false): LocalIntentCommand {
  return { type: PageCommandType.LocalIntent, intent, phase: IntentPhase.Release, fromEscape }
}

export function clientIntent(seq: number, intent: Intent, phase: IntentPhase = IntentPhase.Press): ToPageMessageOf<typeof ToPage.Intent> {
  return { type: ToPage.Intent, seq, intent, phase, source: InputSource.Pad }
}

export function timerFired(timer: TimerKind): UiCommand {
  return { type: PageCommandType.TimerFired, timer }
}

export function openPanel(panel: OwnedPanel, commandSeq: number): ToPageMessageOf<typeof ToPage.OpenPanel> {
  return { type: ToPage.OpenPanel, commandSeq, panel }
}

export function pushPanel(panel: OwnedPanel, parentId: string, commandSeq: number): ToPageMessageOf<typeof ToPage.PushPanel> {
  return { type: ToPage.PushPanel, commandSeq, panel, parentId }
}

export function radialEntries(entries: readonly OwnedRadialEntry[]): ToPageMessageOf<typeof ToPage.RadialEntries> {
  return { type: ToPage.RadialEntries, entries }
}

export const OPEN_RADIAL: UiCommand = { type: ToPage.OpenRadial }

export function bootWith(overrides: Partial<ToPageMessageOf<typeof ToPage.Boot>>): ToPageMessageOf<typeof ToPage.Boot> {
  return { ...TO_PAGE_SAMPLES[ToPage.Boot], ...overrides }
}

export function sent(effects: readonly UiEffect[]): readonly FromPageMessage[] {
  return effects.flatMap((effect) => (effect.type === UiEffectType.SendToHost ? [effect.message] : []))
}

export function sentOf<Type extends FromPage>(effects: readonly UiEffect[], type: Type): readonly FromPageMessageOf<Type>[] {
  return sent(effects).filter((message): message is FromPageMessageOf<Type> => message.type === type)
}

export function events(effects: readonly UiEffect[]): readonly PageEvent[] {
  return sentOf(effects, FromPage.Event).map((message) => message.event)
}

export function replies(effects: readonly UiEffect[]): readonly OwnedReply[] {
  return events(effects).flatMap((event) => event.replies)
}

export function repliesOf<Kind extends ReplyKind>(effects: readonly UiEffect[], kind: Kind): readonly Extract<Reply, { readonly kind: Kind }>[] {
  return replies(effects).flatMap((owned) => (owned.reply.kind === kind ? [owned.reply as Extract<Reply, { readonly kind: Kind }>] : []))
}

export function closedPanels(effects: readonly UiEffect[]): readonly Extract<Reply, { readonly kind: typeof ReplyKind.PanelClosed }>[] {
  return repliesOf(effects, ReplyKind.PanelClosed)
}

export function initial(): UiState {
  return createInitialState()
}

export function withPanels(panels: readonly OwnedPanel[]): UiState {
  const [first, ...rest] = panels
  if (first === undefined) return initial()
  const commands: UiCommand[] = [openPanel(first, 1)]
  rest.forEach((panel, index) => {
    const parent = panels[index]
    if (parent !== undefined) commands.push(pushPanel(panel, parent.panel.id, index + FIRST_PUSH_SEQ))
  })
  return run(initial(), commands).state
}

export function throwingPanel(localId: string): OwnedPanel {
  const panel = { ...menuPanel(localId).panel }
  Object.defineProperty(panel, 'title', { enumerable: true, get: () => { throw new TypeError('hostile title') } })
  return { owner: FixtureOwner.Whitelist, panel }
}

export function throwingConfirm(owned: OwnedConfirm = OWNED_REMOVE_CONFIRM): OwnedConfirm {
  const confirm = { ...owned.confirm }
  Object.defineProperty(confirm, 'title', { enumerable: true, get: () => { throw new TypeError('hostile title') } })
  return { owner: owned.owner, confirm }
}
