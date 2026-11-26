import { ContractVersion, IconName, type ItemKind, NotificationTone, PromptMode, type Item, type Panel, type RadialLeaf } from '@openmemorykit/ui/contract'
import { ITEM_BY_KIND } from '../../../fixtures/items'
import { Modality } from '../../../../src/protocol/intents'
import type { OwnedNotification, OwnedPanel, OwnedPrompt, OwnedRadialEntry } from '../../../../src/protocol/owned'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import type { Translate } from '../../../../src/page/i18n/messages'
import { createInitialState, LayerKind, RadialLevel, type Frame, type Layer, type UiState } from '../../../../src/page/domain/ui-state'
import { ConfirmChoice, ConfirmOrigin } from '../../../../src/page/domain/ui-state'
import { KeyboardLanguage } from '../../../../src/page/domain/keyboard-layouts'
import { openKeyboard } from '../../../../src/page/domain/virtual-keyboard'

export const translate: Translate = (key, params) => (params === undefined ? `t:${key}` : `t:${key}:${JSON.stringify(params)}`)

const VERSION = ContractVersion.V1

export function leaf(id: string): RadialLeaf {
  return { id, label: `Leaf ${id}`, description: `About ${id}`, icon: IconName.Check }
}

export function radialEntry(id: string, childCount = 0): OwnedRadialEntry {
  const children = Array.from({ length: childCount }, (_unused, index) => leaf(`${id}-c${index}`))
  const base = { version: VERSION, id, label: `Entry ${id}`, description: `About ${id}`, icon: IconName.Settings }
  return { owner: 'res', entry: childCount === 0 ? base : { ...base, children } }
}

export function radialState(entries: readonly OwnedRadialEntry[], overrides: Partial<UiState['radial']> = {}): UiState {
  const radial = { entries, level: RadialLevel.Sectors, sectorIndex: 0, childIndex: null, ...overrides }
  return { ...createInitialState(), mode: UiMode.Radial, radial }
}

export function itemOf(kind: Exclude<ItemKind, 'section'>, disabled = false): Item {
  const fixture = ITEM_BY_KIND[kind]
  return disabled ? { ...fixture, disabled: { reason: 'no' } } : fixture
}

export function panelOf(items: readonly Item[]): OwnedPanel {
  const panel: Panel = { version: VERSION, id: 'res/main', kind: 'menu', title: 'Main', items }
  return { owner: 'res', panel }
}

export function panelsState(items: readonly Item[], focusItemId: string | null, layers: readonly Layer[] = []): UiState {
  const frame: Frame = { panel: panelOf(items), focusItemId, layers, form: null, pendingItemId: null, visibleStart: 0 }
  return { ...createInitialState(), mode: UiMode.Panels, stack: [frame] }
}

export function withModality(state: UiState, modality: Modality): UiState {
  return { ...state, modality }
}

export function notification(tone: NotificationTone, title: string, text?: string, key?: string): OwnedNotification {
  const base = { version: VERSION, tone, title }
  return { owner: 'res', notification: { ...base, ...(text === undefined ? {} : { text }), ...(key === undefined ? {} : { key }) } }
}

export function prompt(mode: PromptMode, holdMs?: number): OwnedPrompt {
  return { owner: 'res', prompt: { version: VERSION, id: 'res/open', label: 'Open door', mode, ...(holdMs === undefined ? {} : { holdMs }) } }
}

const KEYBOARD_LIMIT = 40

export const KEYBOARD_LAYER: Layer = {
  kind: LayerKind.Keyboard,
  itemId: 'name',
  initialValue: '',
  keyboard: openKeyboard(KeyboardLanguage.English, '', KEYBOARD_LIMIT),
}

export const CONFIRM_LAYER: Layer = {
  kind: LayerKind.Confirm,
  origin: ConfirmOrigin.Request,
  content: { title: 'Sure?', text: 'Really', confirmLabel: 'Yes' },
  confirmId: 'res/ask',
  itemId: null,
  choice: ConfirmChoice.Confirm,
}
