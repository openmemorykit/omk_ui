import { CloseReason, ItemKind, PANEL_MAX_ITEMS, PanelKind, ReplyKind, STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import type { ConfirmContent, ConfirmRequest, Item, Panel } from '@openmemorykit/ui/contract'
import { splitNamespacedId } from '../../protocol/namespaced-id'
import type { OwnedConfirm, OwnedPanel } from '../../protocol/owned'
import type { OwnedReply } from '../../protocol/stack'
import { mergeFormOnUpdate, openForm, type FormState } from './form'
import { isNewerCommand, isRecord, NO_REPLIES } from './guards'
import { firstFocusable, nearestFocusable } from './list-focus'
import { FORM_SUBMIT_ROW_ID, isSubmitRow, rowWindowStart } from './panel-rows'
import { ConfirmChoice, ConfirmOrigin, LayerKind, type ConfirmLayer, type Frame, type Layer, type UiState } from './ui-state'

export interface StackChange { readonly state: UiState; readonly replies: readonly OwnedReply[] }

export type CloseAllReason = typeof CloseReason.CloseAll | typeof CloseReason.RadialSelection

export const FRAME_MAX_LAYERS = 4

const NOT_FOUND = -1
const FIRST_ROW = 0

const isUsableItem = (item: unknown): boolean => isRecord(item) && typeof item.id === 'string'
const isPanelKind = (kind: unknown): boolean => kind === PanelKind.Menu || kind === PanelKind.Form

export function isAddressablePanel(owned: unknown): owned is OwnedPanel {
  if (!isRecord(owned) || typeof owned.owner !== 'string' || !isRecord(owned.panel) || typeof owned.panel.id !== 'string') return false
  return splitNamespacedId(owned.panel.id)?.owner === owned.owner
}

function hasUsableContent(owned: OwnedPanel): boolean {
  const { kind, items } = owned.panel as unknown as Readonly<Record<string, unknown>>
  return isPanelKind(kind) && Array.isArray(items) && items.length <= PANEL_MAX_ITEMS && items.every(isUsableItem)
}

function discardedReply(owned: OwnedPanel): readonly OwnedReply[] {
  return [{ owner: owned.owner, reply: { kind: ReplyKind.PanelClosed, panelId: owned.panel.id, reason: CloseReason.Discarded } }]
}

const topOf = (stack: readonly Frame[]): Frame | undefined => stack[stack.length - 1]
const panelIdOf = (frame: Frame): string | null => frame.panel?.panel.id ?? null
const isRequestConfirm = (layer: Layer): layer is ConfirmLayer => layer.kind === LayerKind.Confirm && layer.origin === ConfirmOrigin.Request

function confirmOwnerOf(layer: ConfirmLayer): string | null {
  return layer.confirmId === null ? null : splitNamespacedId(layer.confirmId)?.owner ?? null
}

function frameOwner(frame: Frame): string | null {
  if (frame.panel !== null) return frame.panel.owner
  const request = frame.layers.find(isRequestConfirm)
  return request === undefined ? null : confirmOwnerOf(request)
}

function withCommandSeq(state: UiState, commandSeq: number): UiState {
  return isNewerCommand(state.appliedCommandSeq, commandSeq) ? { ...state, appliedCommandSeq: commandSeq } : state
}

function createFrame(owned: OwnedPanel): Frame {
  const { panel } = owned
  const focusItemId = firstFocusable(panel.items)
  return {
    panel: owned,
    focusItemId,
    layers: [],
    form: panel.kind === PanelKind.Form ? openForm(panel) : null,
    pendingItemId: null,
    visibleStart: rowWindowStart(panel, focusItemId, FIRST_ROW),
  }
}

function abandonedConfirmReply(layer: Layer): readonly OwnedReply[] {
  if (!isRequestConfirm(layer) || layer.confirmId === null) return NO_REPLIES
  const owner = confirmOwnerOf(layer)
  return owner === null ? NO_REPLIES : [{ owner, reply: { kind: ReplyKind.ConfirmAnswered, confirmId: layer.confirmId, confirmed: false } }]
}

function frameClosingReplies(frame: Frame, reason: CloseReason): readonly OwnedReply[] {
  const answers = frame.layers.slice().reverse().flatMap(abandonedConfirmReply)
  if (frame.panel === null) return answers
  return answers.concat({ owner: frame.panel.owner, reply: { kind: ReplyKind.PanelClosed, panelId: frame.panel.panel.id, reason } })
}

function closingReplies(frames: readonly Frame[], reason: CloseReason): readonly OwnedReply[] {
  return frames.slice().reverse().flatMap((frame) => frameClosingReplies(frame, reason))
}

export function openPanelFrame(state: UiState, panel: OwnedPanel, commandSeq: number): StackChange {
  const applied = withCommandSeq(state, commandSeq)
  if (!isAddressablePanel(panel)) return { state: applied, replies: NO_REPLIES }
  if (!hasUsableContent(panel)) return { state: applied, replies: discardedReply(panel) }
  return { state: { ...applied, stack: [createFrame(panel)] }, replies: closingReplies(state.stack, CloseReason.ClosedByOwner) }
}

function canPush(stack: readonly Frame[], panel: OwnedPanel, parentId: string): boolean {
  const top = topOf(stack)
  if (top === undefined || top.panel?.owner !== panel.owner || panelIdOf(top) !== parentId || stack.length >= STACK_MAX_DEPTH) return false
  return !stack.some((frame) => panelIdOf(frame) === panel.panel.id)
}

export function pushPanelFrame(state: UiState, panel: OwnedPanel, parentId: string, commandSeq: number): StackChange {
  const applied = withCommandSeq(state, commandSeq)
  if (!isAddressablePanel(panel)) return { state: applied, replies: NO_REPLIES }
  if (!hasUsableContent(panel) || !canPush(state.stack, panel, parentId)) return { state: applied, replies: discardedReply(panel) }
  const parents = state.stack.map((frame, index) => (index === state.stack.length - 1 ? { ...frame, pendingItemId: null } : frame))
  return { state: { ...applied, stack: parents.concat(createFrame(panel)) }, replies: NO_REPLIES }
}

function refreshedForm(form: FormState | null, panel: Panel): FormState | null {
  if (panel.kind !== PanelKind.Form) return null
  return form === null ? openForm(panel) : mergeFormOnUpdate(form, panel)
}

function layerSurvives(layer: Layer, itemsById: ReadonlyMap<string, Item>): boolean {
  if (layer.itemId === null) return true
  const item = itemsById.get(layer.itemId)
  return layer.kind === LayerKind.Keyboard ? item?.kind === ItemKind.Text : item !== undefined
}

function refreshFrame(frame: Frame, owned: OwnedPanel): Frame {
  const { items } = owned.panel
  const itemsById: ReadonlyMap<string, Item> = new Map(items.map((item) => [item.id, item] as const))
  const focusItemId = isSubmitRow(owned.panel, frame.focusItemId) ? FORM_SUBMIT_ROW_ID : nearestFocusable(items, frame.panel?.panel.items ?? [], frame.focusItemId)
  const pendingItemId = frame.pendingItemId !== null && itemsById.has(frame.pendingItemId) ? frame.pendingItemId : null
  return {
    panel: owned,
    focusItemId,
    layers: frame.layers.filter((layer) => layerSurvives(layer, itemsById)),
    form: refreshedForm(frame.form, owned.panel),
    pendingItemId,
    visibleStart: rowWindowStart(owned.panel, focusItemId, frame.visibleStart),
  }
}

export function updatePanelFrame(state: UiState, panel: OwnedPanel): UiState {
  if (!isAddressablePanel(panel) || !hasUsableContent(panel)) return state
  const index = state.stack.findIndex((frame) => frame.panel !== null && frame.panel.owner === panel.owner && frame.panel.panel.id === panel.panel.id)
  if (index === NOT_FOUND) return state
  return { ...state, stack: state.stack.map((frame, position) => (position === index ? refreshFrame(frame, panel) : frame)) }
}

export function closePanelFrame(state: UiState, panelId: string, commandSeq: number): StackChange {
  const applied = withCommandSeq(state, commandSeq)
  const index = typeof panelId === 'string' ? state.stack.findIndex((frame) => panelIdOf(frame) === panelId) : NOT_FOUND
  if (index === NOT_FOUND) return { state: applied, replies: NO_REPLIES }
  return { state: { ...applied, stack: state.stack.slice(0, index) }, replies: closingReplies(state.stack.slice(index), CloseReason.ClosedByOwner) }
}

export function dropOwnerFrames(state: UiState, owner: string, commandSeq: number): UiState {
  const applied = withCommandSeq(state, commandSeq)
  const stack = state.stack.filter((frame) => frameOwner(frame) !== owner)
  return stack.length === state.stack.length ? applied : { ...applied, stack }
}

function contentOf(confirm: ConfirmRequest): ConfirmContent {
  const { title, text, confirmLabel, cancelLabel, danger } = confirm
  return { title, text, confirmLabel, ...(cancelLabel === undefined ? {} : { cancelLabel }), ...(danger === undefined ? {} : { danger }) }
}

function requestLayer(owned: OwnedConfirm): ConfirmLayer | null {
  if (!isRecord(owned) || !isRecord(owned.confirm) || typeof owned.confirm.id !== 'string') return null
  const { owner, confirm } = owned
  if (splitNamespacedId(confirm.id)?.owner !== owner) return null
  const choice = confirm.danger === true ? ConfirmChoice.Cancel : ConfirmChoice.Confirm
  return { kind: LayerKind.Confirm, origin: ConfirmOrigin.Request, content: contentOf(confirm), confirmId: confirm.id, itemId: null, choice }
}

export function isConfirmShown(stack: readonly Frame[], confirmId: string | null): boolean {
  return stack.some((frame) => frame.layers.some((layer) => isRequestConfirm(layer) && layer.confirmId === confirmId))
}

export function showConfirmLayer(state: UiState, confirm: OwnedConfirm, commandSeq: number): UiState {
  const applied = withCommandSeq(state, commandSeq)
  const layer = requestLayer(confirm)
  if (layer === null || isConfirmShown(state.stack, layer.confirmId)) return applied
  const top = topOf(state.stack)
  if (top === undefined) {
    return { ...applied, stack: [{ panel: null, focusItemId: null, layers: [layer], form: null, pendingItemId: null, visibleStart: FIRST_ROW }] }
  }
  if (frameOwner(top) !== confirm.owner || top.layers.length >= FRAME_MAX_LAYERS) return applied
  return { ...applied, stack: state.stack.slice(0, -1).concat({ ...top, layers: top.layers.concat(layer) }) }
}

export function popTopFrame(state: UiState): StackChange {
  const top = topOf(state.stack)
  if (top === undefined) return { state, replies: NO_REPLIES }
  return { state: { ...state, stack: state.stack.slice(0, -1) }, replies: frameClosingReplies(top, CloseReason.Back) }
}

export function closeAllFrames(state: UiState, reason: CloseAllReason = CloseReason.CloseAll): StackChange {
  if (state.stack.length === 0) return { state, replies: NO_REPLIES }
  return { state: { ...state, stack: [] }, replies: closingReplies(state.stack, reason) }
}
