import { PROMPT_HOLD_DEFAULT_MS } from '@openmemorykit/ui/contract'
import { Modality } from '../../protocol/intents'
import type { OwnedPrompt } from '../../protocol/owned'
import { FromPage } from '../../protocol/from-page'
import { GlyphSet, PromptState } from '../../protocol/page-vocabulary'
import type { ToPage } from '../../protocol/to-page'
import type { JsonObject } from '../../shared/report/json-value'
import { ResolveOutcome, resolveSubmission } from './form'
import { rejectionEffects } from './form-handler'
import { closePanelFrame, updatePanelFrame } from './navigation'
import { TimerKind, type UiCommandOf } from './page-commands'
import { expireToasts, nextToastExpiry, pushToast, type ToastQueue } from './toasts'
import { cancelSchedule, schedule, sendToHost, stackEvent, unchanged, withEffects, type CommandHandler, type Transition, type UiEffect } from './ui-effects'
import { releaseAllIntents, type Frame, type PromptView, type UiState } from './ui-state'

const NO_HOLD_MS = 0
const NOTHING_HELD = 0
const EVERYTHING_HELD = 1
const NOT_FOUND = -1
const GLYPH_SETS: ReadonlySet<unknown> = new Set(Object.values(GlyphSet))
const MODALITIES: ReadonlySet<unknown> = new Set(Object.values(Modality))

export function isGlyphSet(value: unknown): value is GlyphSet {
  return GLYPH_SETS.has(value)
}

export function promptView(prompt: OwnedPrompt): PromptView {
  return { prompt, state: null, holdMs: NO_HOLD_MS, holdStartedAt: null, heldFraction: NOTHING_HELD }
}

function toastSchedule(queue: ToastQueue, now: number): readonly UiEffect[] {
  const expiry = nextToastExpiry(queue)
  return expiry === null ? [] : [schedule(TimerKind.ToastExpiry, expiry - now)]
}

export const handleNotify: CommandHandler<UiCommandOf<typeof ToPage.Notify>> = (state, message, now) => {
  const toasts = pushToast(state.toasts, message.notification, now)
  return withEffects({ ...state, toasts }, toastSchedule(toasts, now))
}

export function expireToastQueue(state: UiState, now: number): Transition {
  const toasts = expireToasts(state.toasts, now)
  return withEffects(toasts === state.toasts ? state : { ...state, toasts }, toastSchedule(toasts, now))
}

export const handleShowPrompt: CommandHandler<UiCommandOf<typeof ToPage.ShowPrompt>> = (state, message) => unchanged({ ...state, prompt: promptView(message.prompt) })

function isShownPrompt(state: UiState, promptId: string): boolean {
  return state.prompt !== null && state.prompt.prompt.prompt.id === promptId
}

function heldFractionAtCancel(shown: PromptView, message: UiCommandOf<typeof ToPage.PromptProgress>, now: number): number {
  const holdMs = message.holdMs > NO_HOLD_MS ? message.holdMs : shown.prompt.prompt.holdMs ?? PROMPT_HOLD_DEFAULT_MS
  if (shown.holdStartedAt === null || !Number.isFinite(now)) return NOTHING_HELD
  return Math.min(Math.max((now - shown.holdStartedAt) / holdMs, NOTHING_HELD), EVERYTHING_HELD)
}

function progressed(shown: PromptView, message: UiCommandOf<typeof ToPage.PromptProgress>, now: number): PromptView {
  const next = { ...shown, state: message.state, holdMs: message.holdMs }
  switch (message.state) {
    case PromptState.Holding:
      return { ...next, holdStartedAt: shown.state === PromptState.Holding ? shown.holdStartedAt : now, heldFraction: NOTHING_HELD }
    case PromptState.Cancelled:
      return { ...next, holdStartedAt: null, heldFraction: heldFractionAtCancel(shown, message, now) }
    default:
      return { ...next, holdStartedAt: null, heldFraction: EVERYTHING_HELD }
  }
}

export const handlePromptProgress: CommandHandler<UiCommandOf<typeof ToPage.PromptProgress>> = (state, message, now) => {
  if (state.prompt === null || !isShownPrompt(state, message.promptId)) return unchanged(state)
  return unchanged({ ...state, prompt: progressed(state.prompt, message, now) })
}

export const handleHidePrompt: CommandHandler<UiCommandOf<typeof ToPage.HidePrompt>> = (state, message) =>
  unchanged(isShownPrompt(state, message.promptId) ? { ...state, prompt: null } : state)

export const handleGlyphSet: CommandHandler<UiCommandOf<typeof ToPage.GlyphSet>> = (state, message) =>
  unchanged(isGlyphSet(message.glyphSet) && message.glyphSet !== state.glyphSet ? { ...state, glyphSet: message.glyphSet } : state)

export function changeModality(state: UiState, modality: Modality): Transition {
  if (!MODALITIES.has(modality) || modality === state.modality) return unchanged(state)
  return unchanged({ ...releaseAllIntents(state), modality })
}

export const handleModality: CommandHandler<UiCommandOf<typeof ToPage.Modality>> = (state, message) => changeModality(state, message.modality)

const hasPendingLink = (state: UiState): boolean => state.stack.some((frame) => frame.pendingItemId !== null)

export const handleUpdatePanel: CommandHandler<UiCommandOf<typeof ToPage.UpdatePanel>> = (state, message) => {
  const updated = updatePanelFrame(state, message.panel)
  return withEffects(updated, hasPendingLink(state) && !hasPendingLink(updated) ? [cancelSchedule(TimerKind.LinkPending)] : [])
}

const isFormFrame = (panelId: string) => (frame: Frame): boolean => frame.form !== null && frame.panel?.panel.id === panelId

export const handleResolveForm: CommandHandler<UiCommandOf<typeof ToPage.ResolveForm>> = (state, message) => {
  const index = state.stack.findIndex(isFormFrame(message.panelId))
  const form = state.stack[index]?.form ?? null
  if (index === NOT_FOUND || form === null) return unchanged(state)
  const resolved = resolveSubmission(form, message.submissionId, message.result)
  if (resolved.outcome === ResolveOutcome.Ignored) return unchanged(state)
  const updated = { ...state, stack: state.stack.map((frame, position) => (position === index ? { ...frame, form: resolved.state } : frame)) }
  if (!resolved.close) return withEffects(updated, rejectionEffects(resolved.state, message.panelId))
  const change = closePanelFrame(updated, message.panelId, updated.appliedCommandSeq)
  return withEffects(change.state, [stackEvent(change.state, change.replies)])
}

function pageSnapshot(state: UiState): JsonObject {
  return {
    mode: state.mode,
    paused: state.paused,
    modality: state.modality,
    escapeHeld: state.escapeHeld,
    appliedCommandSeq: state.appliedCommandSeq,
    lastIntentSeq: state.lastIntentSeq,
    stack: state.stack.map((frame) => frame.panel?.panel.id ?? null),
    radialLevel: state.radial.level,
    radialEntries: state.radial.entries.length,
    visibleToasts: state.toasts.visible.length,
    waitingToasts: state.toasts.waiting.length,
    prompt: state.prompt?.prompt.prompt.id ?? null,
  }
}

export const handleSnapshotRequest: CommandHandler<UiCommandOf<typeof ToPage.SnapshotRequest>> = (state, message) => {
  if (!Number.isSafeInteger(message.requestId)) return unchanged(state)
  return withEffects(state, [sendToHost({ type: FromPage.Snapshot, requestId: message.requestId, snapshot: pageSnapshot(state) })])
}
