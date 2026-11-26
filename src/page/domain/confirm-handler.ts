import { ItemKind, ReplyKind } from '@openmemorykit/ui/contract'
import { Intent, IntentPhase, Modality } from '../../protocol/intents'
import { splitNamespacedId } from '../../protocol/namespaced-id'
import type { OwnedReply } from '../../protocol/stack'
import { replyEvent, topFrameOf, topLayerOf, withoutTopLayer, withTopFrame } from './frame-updates'
import { NO_REPLIES } from './guards'
import { closeKeyboardLayer } from './keyboard-handler'
import { PageCommandType, type LocalIntentCommand, type UiCommand } from './page-commands'
import { unchanged, UiEffectType, withEffects, type CommandHandler, type Transition, type UiEffect } from './ui-effects'
import { ConfirmChoice, ConfirmOrigin, LayerKind, type ConfirmLayer, type Frame, type UiState } from './ui-state'

interface ConfirmContext { readonly frame: Frame; readonly layer: ConfirmLayer }

const LAST = -1
const CHOICES: ReadonlyMap<unknown, ConfirmChoice> = new Map(Object.values(ConfirmChoice).map((choice) => [choice, choice] as const))

function withReplies(state: UiState, replies: readonly OwnedReply[]): Transition {
  return withEffects(state, replies.length === 0 ? [] : [replyEvent(replies)])
}

function requestReplies(layer: ConfirmLayer, confirmed: boolean): readonly OwnedReply[] {
  const owner = layer.confirmId === null ? undefined : splitNamespacedId(layer.confirmId)?.owner
  if (layer.confirmId === null || owner === undefined) return NO_REPLIES
  return [{ owner, reply: { kind: ReplyKind.ConfirmAnswered, confirmId: layer.confirmId, confirmed } }]
}

function refocusedText(frame: Frame): readonly UiEffect[] {
  const uncovered = topLayerOf(frame)
  return uncovered?.kind === LayerKind.Keyboard ? [{ type: UiEffectType.FocusTextInput, itemId: uncovered.itemId }] : []
}

function answerRequest(state: UiState, context: ConfirmContext, confirmed: boolean, fromEscape: boolean): Transition {
  const frame = withoutTopLayer(context.frame)
  const keepsFrame = frame.panel !== null || frame.layers.length > 0
  const stack = keepsFrame ? state.stack.slice(0, LAST).concat(frame) : state.stack.slice(0, LAST)
  const escapeHeld = stack.length === 0 ? fromEscape : state.escapeHeld
  const answered = withReplies({ ...state, stack, escapeHeld }, requestReplies(context.layer, confirmed))
  return withEffects(answered.state, answered.effects.concat(refocusedText(frame)))
}

function itemReplies(frame: Frame, itemId: string | null, confirmed: boolean): readonly OwnedReply[] {
  const owned = frame.panel
  const item = owned?.panel.items.find((candidate) => candidate.id === itemId)
  if (!confirmed || owned === null || item === undefined || item.kind !== ItemKind.Action || item.disabled !== undefined) return NO_REPLIES
  return [{ owner: owned.owner, reply: { kind: ReplyKind.ItemSelected, panelId: owned.panel.id, itemId: item.id } }]
}

function answerAbandon(state: UiState, context: ConfirmContext, confirmed: boolean): Transition {
  if (confirmed) {
    const closed = closeKeyboardLayer(state, null)
    return closed.state === state ? unchanged(withTopFrame(state, withoutTopLayer(context.frame))) : closed
  }
  const frame = withoutTopLayer(context.frame)
  return withEffects(withTopFrame(state, frame), refocusedText(frame))
}

function answer(state: UiState, context: ConfirmContext, confirmed: boolean, fromEscape: boolean): Transition {
  const { frame, layer } = context
  switch (layer.origin) {
    case ConfirmOrigin.Request:
      return answerRequest(state, context, confirmed, fromEscape)
    case ConfirmOrigin.Item:
      return withReplies(withTopFrame(state, withoutTopLayer(frame)), itemReplies(frame, layer.itemId, confirmed))
    case ConfirmOrigin.AbandonText:
      return answerAbandon(state, context, confirmed)
    default:
      return unchanged(state)
  }
}

function withChoice(state: UiState, context: ConfirmContext, choice: ConfirmChoice): Transition {
  if (choice === context.layer.choice) return unchanged(state)
  const layers = context.frame.layers.slice(0, LAST).concat({ ...context.layer, choice })
  return unchanged(withTopFrame(state, { ...context.frame, layers }))
}

function confirmIntent(state: UiState, context: ConfirmContext, command: LocalIntentCommand): Transition {
  const other = context.layer.choice === ConfirmChoice.Confirm ? ConfirmChoice.Cancel : ConfirmChoice.Confirm
  switch (command.intent) {
    case Intent.Up:
    case Intent.Down:
      return withChoice(state, context, other)
    case Intent.Confirm:
      return answer(state, context, context.layer.choice === ConfirmChoice.Confirm, false)
    case Intent.Back:
      return answer(state, context, false, command.fromEscape)
    default:
      return unchanged(state)
  }
}

function hovered(state: UiState, context: ConfirmContext, itemId: unknown): Transition {
  const choice = CHOICES.get(itemId)
  return choice === undefined || state.modality !== Modality.KeyboardMouse ? unchanged(state) : withChoice(state, context, choice)
}

function clicked(state: UiState, context: ConfirmContext, itemId: unknown): Transition {
  const choice = CHOICES.get(itemId)
  return choice === undefined ? unchanged(state) : answer(state, context, choice === ConfirmChoice.Confirm, false)
}

function confirmContext(state: UiState): ConfirmContext | null {
  const frame = topFrameOf(state)
  const layer = frame === undefined ? undefined : topLayerOf(frame)
  return frame === undefined || layer?.kind !== LayerKind.Confirm ? null : { frame, layer }
}

export const handleConfirmLayer: CommandHandler<UiCommand> = (state, command) => {
  const context = confirmContext(state)
  if (context === null) return unchanged(state)
  switch (command.type) {
    case PageCommandType.LocalIntent:
      return command.phase === IntentPhase.Press ? confirmIntent(state, context, command) : unchanged(state)
    case PageCommandType.HoverItem:
      return hovered(state, context, command.itemId)
    case PageCommandType.ClickItem:
      return clicked(state, context, command.itemId)
    default:
      return unchanged(state)
  }
}
