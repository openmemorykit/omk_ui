import { ItemKind, ReplyKind, type FieldValue, type Item } from '@openmemorykit/ui/contract'
import { Intent } from '../../protocol/intents'
import type { OwnedPanel } from '../../protocol/owned'
import type { OwnedReply } from '../../protocol/stack'
import { changeField, currentFieldValue, isFormLocked } from './field-values'
import type { FieldItem } from './form-rules'
import { submitTopForm } from './form-handler'
import { replyEvent, topFrameOf, withLayer, withTopFrame } from './frame-updates'
import { openKeyboardLayer } from './keyboard-handler'
import { LINK_PENDING_MS, TimerKind } from './page-commands'
import { focusableItem, isSubmitRow } from './panel-rows'
import { schedule, unchanged, withEffects, type Transition } from './ui-effects'
import { ConfirmChoice, ConfirmOrigin, LayerKind, type ConfirmLayer, type Frame, type UiState } from './ui-state'

type ItemOf<Kind extends ItemKind> = Extract<Item, { readonly kind: Kind }>

const PREVIOUS = -1
const NEXT = 1
const NOT_FOUND = -1
const FIRST_OPTION = 0

function selectedReply(owned: OwnedPanel, itemId: string): OwnedReply {
  return { owner: owned.owner, reply: { kind: ReplyKind.ItemSelected, panelId: owned.panel.id, itemId } }
}

function itemConfirmLayer(item: ItemOf<typeof ItemKind.Action>, content: NonNullable<ItemOf<typeof ItemKind.Action>['confirm']>): ConfirmLayer {
  const choice = content.danger === true ? ConfirmChoice.Cancel : ConfirmChoice.Confirm
  return { kind: LayerKind.Confirm, origin: ConfirmOrigin.Item, content, confirmId: null, itemId: item.id, choice }
}

function action(state: UiState, frame: Frame, owned: OwnedPanel, item: ItemOf<typeof ItemKind.Action>): Transition {
  if (item.confirm === undefined) return withEffects(state, [replyEvent([selectedReply(owned, item.id)])])
  return unchanged(withTopFrame(state, withLayer(frame, itemConfirmLayer(item, item.confirm))))
}

function link(state: UiState, frame: Frame, owned: OwnedPanel, item: ItemOf<typeof ItemKind.Link>): Transition {
  if (frame.pendingItemId === item.id) return unchanged(state)
  const pending = withTopFrame(state, { ...frame, pendingItemId: item.id })
  return withEffects(pending, [replyEvent([selectedReply(owned, item.id)]), schedule(TimerKind.LinkPending, LINK_PENDING_MS)])
}

function fieldChanged(state: UiState, frame: Frame, item: FieldItem, value: FieldValue | null): Transition {
  if (value === null) return unchanged(state)
  const change = changeField(frame, item, value)
  if (change.frame === frame) return unchanged(state)
  return withEffects(withTopFrame(state, change.frame), change.replies.length === 0 ? [] : [replyEvent(change.replies)])
}

function cycleStep(intent: Intent): 1 | -1 | null {
  if (intent === Intent.Left) return PREVIOUS
  return intent === Intent.Right || intent === Intent.Confirm ? NEXT : null
}

function steppedOption(item: ItemOf<typeof ItemKind.Cycle>, current: FieldValue, step: 1 | -1): string | null {
  const { options } = item
  const index = options.findIndex((option) => option.id === current)
  const target = index === NOT_FOUND ? (step === NEXT ? FIRST_OPTION : options.length + PREVIOUS) : (index + step + options.length) % options.length
  return options[target]?.id ?? null
}

function cycled(state: UiState, frame: Frame, item: ItemOf<typeof ItemKind.Cycle>, intent: Intent): Transition {
  const step = cycleStep(intent)
  return fieldChanged(state, frame, item, step === null ? null : steppedOption(item, currentFieldValue(frame, item), step))
}

function toggledValue(current: FieldValue, intent: Intent): boolean | null {
  switch (intent) {
    case Intent.Confirm:
      return current !== true
    case Intent.Left:
      return false
    case Intent.Right:
      return true
    default:
      return null
  }
}

function activated(state: UiState, frame: Frame, owned: OwnedPanel, item: Exclude<Item, ItemOf<typeof ItemKind.Section>>, intent: Intent): Transition {
  const confirms = intent === Intent.Confirm
  switch (item.kind) {
    case ItemKind.Action:
      return confirms ? action(state, frame, owned, item) : unchanged(state)
    case ItemKind.Link:
      return confirms ? link(state, frame, owned, item) : unchanged(state)
    case ItemKind.Cycle:
      return cycled(state, frame, item, intent)
    case ItemKind.Toggle:
      return fieldChanged(state, frame, item, toggledValue(currentFieldValue(frame, item), intent))
    case ItemKind.Text:
      return confirms && !isFormLocked(frame) ? openKeyboardLayer(state, frame, item) : unchanged(state)
    default:
      return unchanged(state)
  }
}

export function activateItem(state: UiState, intent: Intent, now: number): Transition {
  const frame = topFrameOf(state)
  const owned = frame?.panel ?? null
  if (frame === undefined || owned === null) return unchanged(state)
  if (isSubmitRow(owned.panel, frame.focusItemId)) return intent === Intent.Confirm ? submitTopForm(state, now) : unchanged(state)
  const item = focusableItem(owned.panel, frame.focusItemId)
  if (item === undefined || item.kind === ItemKind.Section || item.disabled !== undefined) return unchanged(state)
  return activated(state, frame, owned, item, intent)
}
