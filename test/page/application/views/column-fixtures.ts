import { ItemKind, type Item } from '@openmemorykit/ui/contract'
import french from '../../../../omk_ui/locales/fr.json'
import { openPanelFrame, pushPanelFrame } from '../../../../src/page/domain/navigation'
import { createInitialState, type Frame, type UiState } from '../../../../src/page/domain/ui-state'
import type { Translate } from '../../../../src/page/i18n/messages'
import { createTranslator } from '../../../../src/page/i18n/translator'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_LIST_PANEL } from '../../../fixtures/owned'
import { menuPanel } from '../../domain/navigation-helpers'

const translator = createTranslator(() => undefined)
translator.load({ language: 'fr', messages: french })

export const translate: Translate = translator.translate

const FIRST_COMMAND = 1
const SECOND_COMMAND = 2

export function panelsState(): UiState {
  return { ...openPanelFrame(createInitialState(), OWNED_LIST_PANEL, FIRST_COMMAND).state, mode: UiMode.Panels }
}

export function formState(): UiState {
  return { ...openPanelFrame(createInitialState(), OWNED_ADD_PANEL, FIRST_COMMAND).state, mode: UiMode.Panels }
}

export function stateOfItems(items: readonly Item[]): UiState {
  return { ...openPanelFrame(createInitialState(), menuPanel('long', FixtureOwner.Whitelist, items), FIRST_COMMAND).state, mode: UiMode.Panels }
}

export function pushedState(state: UiState): UiState {
  const parent = state.stack[state.stack.length - 1]?.panel?.panel.id ?? ''
  return { ...pushPanelFrame(state, menuPanel('child'), parent, SECOND_COMMAND).state, mode: UiMode.Panels }
}

export function topFrameOf(state: UiState): Frame {
  const frame = state.stack[state.stack.length - 1]
  if (frame === undefined) throw new Error('frame expected')
  return frame
}

export function withTop(state: UiState, changes: Partial<Frame>): UiState {
  const top = topFrameOf(state)
  return { ...state, stack: state.stack.slice(0, -1).concat({ ...top, ...changes }) }
}

export function manyItems(count: number): readonly Item[] {
  return Array.from({ length: count }, (_, index) => ({ kind: ItemKind.Info, id: `row-${String(index)}`, label: `Row ${String(index)}`, value: String(index) }))
}

export function hasFunction(value: unknown): boolean {
  if (typeof value === 'function') return true
  if (typeof value !== 'object' || value === null) return false
  return Object.values(value).some(hasFunction)
}

export function isDeeplyFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true
  return Object.isFrozen(value) && Object.values(value).every(isDeeplyFrozen)
}

export function omit<Value extends object, Key extends keyof Value>(value: Value, key: Key): Omit<Value, Key> {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)) as Omit<Value, Key>
}
