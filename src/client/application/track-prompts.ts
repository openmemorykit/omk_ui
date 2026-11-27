import { PROMPT_HOLD_DEFAULT_MS, PromptMode, ReplyKind, type Prompt } from '@openmemorykit/ui/contract'
import { Modality } from '../../protocol/intents'
import { namespaceId } from '../../protocol/namespaced-id'
import { UiMode } from '../../protocol/page-vocabulary'
import { ToPage } from '../../protocol/to-page'
import { ReportKind } from '../../shared/report/report-kind'
import { advancePrompt, cancelPrompt, HoldSource, pressPrompt, PromptPhase, releasePrompt, SHOWN_PROMPT, type PromptHold } from '../domain/hold-prompt'
import { visiblePrompt, type RegisteredPrompt } from '../domain/owner-registry'
import type { ClientPorts } from './ports'
import type { ClientSession, SessionStore } from './session-state'
import { traceLine } from './trace'

export const INTERACT_CONTROL = 51

type PromptMove = (hold: PromptHold, visible: RegisteredPrompt, now: number) => PromptHold
type ChangedHold = Exclude<PromptHold, { readonly phase: typeof PromptPhase.Shown }>

function holdMsOf(prompt: Prompt): number {
  return prompt.mode === PromptMode.Press ? 0 : (prompt.holdMs ?? PROMPT_HOLD_DEFAULT_MS)
}

function pressFrom(source: HoldSource): PromptMove {
  return (hold, visible, now) => pressPrompt(hold, visible.prompt.mode, now, { owner: visible.owner, promptId: visible.prompt.id, source })
}

const pressByCommand = pressFrom(HoldSource.Command)
const pressByPad = pressFrom(HoldSource.Pad)
const release: PromptMove = (hold, visible, now) => releasePrompt(hold, now, holdMsOf(visible.prompt))
const advance: PromptMove = (hold, visible, now) => advancePrompt(hold, now, holdMsOf(visible.prompt))
const cancel: PromptMove = (hold) => cancelPrompt(hold)

function isHeldBy(hold: PromptHold, visible: RegisteredPrompt): boolean {
  return hold.phase === PromptPhase.Holding && hold.held.owner === visible.owner && hold.held.promptId === visible.prompt.id
}

function deliverCompletion(ports: ClientPorts, store: SessionStore, visible: RegisteredPrompt): void {
  const delivered = ports.replies.deliver(visible.owner, { kind: ReplyKind.PromptCompleted, promptId: visible.prompt.id })
  if (delivered) return
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.ReplyUndelivered, data: { owner: visible.owner, reply: ReplyKind.PromptCompleted } })
}

function announce(ports: ClientPorts, store: SessionStore, visible: RegisteredPrompt, hold: ChangedHold): void {
  const promptId = namespaceId(visible.owner, visible.prompt.id)
  ports.nui.send({ type: ToPage.PromptProgress, promptId, state: hold.phase, holdMs: holdMsOf(visible.prompt) })
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.PromptChanged, data: { owner: visible.owner, promptId, state: hold.phase } })
  if (hold.phase === PromptPhase.Completed) deliverCompletion(ports, store, visible)
  if (hold.phase !== PromptPhase.Holding) store.write({ ...store.read(), prompt: SHOWN_PROMPT })
}

function moveVisiblePrompt(ports: ClientPorts, store: SessionStore, move: PromptMove): void {
  const session = store.read()
  const visible = visiblePrompt(session.registry)
  if (visible === null) return
  if (session.prompt.phase === PromptPhase.Holding && !isHeldBy(session.prompt, visible)) return
  const next = move(session.prompt, visible, ports.clock.now())
  if (next === session.prompt || next.phase === PromptPhase.Shown) return
  store.write({ ...session, prompt: next })
  announce(ports, store, visible, next)
}

export function interactPress(ports: ClientPorts, store: SessionStore): void {
  if (store.read().mode !== UiMode.Idle) return
  moveVisiblePrompt(ports, store, pressByCommand)
}

export function interactRelease(ports: ClientPorts, store: SessionStore): void {
  moveVisiblePrompt(ports, store, release)
}

function readsInteractControl(session: ClientSession): boolean {
  return session.mode === UiMode.Idle && !session.paused && session.modality === Modality.Gamepad
}

function readInteractControl(ports: ClientPorts, store: SessionStore): void {
  const phase = store.read().prompt.phase
  if (phase === PromptPhase.Shown && ports.controls.isJustPressed(INTERACT_CONTROL)) moveVisiblePrompt(ports, store, pressByPad)
  else if (phase === PromptPhase.Holding && !ports.controls.isDisabledPressed(INTERACT_CONTROL)) moveVisiblePrompt(ports, store, release)
}

function holdLostItsConditions(session: ClientSession, hold: PromptHold): boolean {
  if (hold.phase !== PromptPhase.Holding) return false
  return hold.held.source === HoldSource.Pad ? !readsInteractControl(session) : session.mode !== UiMode.Idle || session.paused
}

export function trackPromptFrame(ports: ClientPorts, store: SessionStore): void {
  const session = store.read()
  const visible = visiblePrompt(session.registry)
  if (visible === null || (session.prompt.phase === PromptPhase.Holding && !isHeldBy(session.prompt, visible))) {
    if (session.prompt !== SHOWN_PROMPT) store.write({ ...session, prompt: SHOWN_PROMPT })
    return
  }
  if (holdLostItsConditions(session, session.prompt)) {
    moveVisiblePrompt(ports, store, cancel)
    return
  }
  if (readsInteractControl(session)) readInteractControl(ports, store)
  moveVisiblePrompt(ports, store, advance)
}
