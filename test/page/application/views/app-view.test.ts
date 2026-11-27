import { describe, expect, it } from 'vitest'
import { ItemKind, NotificationTone, PromptMode } from '@openmemorykit/ui/contract'
import { appView, AppLayerKind, LegendHost } from '../../../../src/page/application/views/app-view'
import { KeyboardLanguage } from '../../../../src/page/domain/keyboard-layouts'
import { EMPTY_TOASTS, pushToast } from '../../../../src/page/domain/toasts'
import { ConfirmChoice, ConfirmOrigin, createInitialState, LayerKind, type Frame, type Layer, type UiState } from '../../../../src/page/domain/ui-state'
import { openKeyboard } from '../../../../src/page/domain/virtual-keyboard'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import { itemOf, notification, panelsState, prompt, radialEntry, radialState, translate } from './helpers'

const NOW = 1_000
const LIMIT = 40
const TEXT_ITEM = itemOf(ItemKind.Text)

const confirmLayer: Layer = {
  kind: LayerKind.Confirm,
  origin: ConfirmOrigin.Request,
  content: { title: 'Remove', text: 'Remove this player?', confirmLabel: 'Remove', cancelLabel: 'Keep' },
  confirmId: 'whitelist/remove',
  itemId: null,
  choice: ConfirmChoice.Cancel,
}

const keyboardLayer: Layer = {
  kind: LayerKind.Keyboard,
  itemId: TEXT_ITEM.id,
  initialValue: '',
  keyboard: openKeyboard(KeyboardLanguage.French, '', LIMIT),
}

function withLayers(state: UiState, layers: readonly Layer[]): UiState {
  const top = state.stack[state.stack.length - 1]
  if (top === undefined) throw new Error('frame expected')
  return { ...state, stack: state.stack.slice(0, -1).concat({ ...top, layers }) }
}

function confirmAlone(): UiState {
  const frame: Frame = { panel: null, focusItemId: null, layers: [confirmLayer], form: null, pendingItemId: null, visibleStart: 0 }
  return { ...createInitialState(), mode: UiMode.Panels, stack: [frame] }
}

describe('appView', () => {
  it('shows nothing at rest', () => {
    expect(appView(createInitialState(), translate)).toEqual({ lang: createInitialState().language, visible: false, layer: null, layerAlone: false, legend: LegendHost.None })
  })

  it('carries the language of the state', () => {
    expect(appView({ ...createInitialState(), language: 'fr' }, translate).lang).toBe('fr')
  })

  it('is visible with a column, whose legend sits in the column', () => {
    const view = appView(panelsState([TEXT_ITEM], TEXT_ITEM.id), translate)
    expect(view).toMatchObject({ visible: true, layer: null, layerAlone: false, legend: LegendHost.Column })
  })

  it('is visible with a radial menu, whose legend sits in the radial menu even over a column', () => {
    expect(appView(radialState([radialEntry('a'), radialEntry('b'), radialEntry('c')]), translate)).toMatchObject({ visible: true, legend: LegendHost.Radial })
    const over = { ...panelsState([TEXT_ITEM], TEXT_ITEM.id), radial: radialState([radialEntry('a'), radialEntry('b'), radialEntry('c')]).radial, mode: UiMode.Radial }
    expect(appView(over, translate)).toMatchObject({ visible: true, legend: LegendHost.Radial })
  })

  it('is visible for a toast alone', () => {
    const toasts = pushToast(EMPTY_TOASTS, notification(NotificationTone.Info, 'Saved'), NOW)
    expect(appView({ ...createInitialState(), toasts }, translate)).toMatchObject({ visible: true, legend: LegendHost.None })
  })

  it('is visible for a prompt alone', () => {
    const state = { ...createInitialState(), prompt: { prompt: prompt(PromptMode.Press), state: null, holdMs: 0 } }
    expect(appView(state, translate).visible).toBe(true)
  })

  it('places a confirmation of the top frame in the column layer', () => {
    const view = appView(withLayers(panelsState([TEXT_ITEM], TEXT_ITEM.id), [confirmLayer]), translate)
    expect(view.layerAlone).toBe(false)
    expect(view.layer).toMatchObject({ kind: AppLayerKind.Confirm, view: { title: 'Remove', choices: [{ label: 'Remove' }, { label: 'Keep', focused: true }] } })
  })

  it('renders a confirmation alone, visible, when the top frame has no panel', () => {
    const view = appView(confirmAlone(), translate)
    expect(view).toMatchObject({ visible: true, layerAlone: true, legend: LegendHost.None })
    expect(view.layer?.kind).toBe(AppLayerKind.Confirm)
  })

  it('does not render a confirmation alone while the radial menu is open', () => {
    const radial = radialState([radialEntry('a'), radialEntry('b'), radialEntry('c')]).radial
    const view = appView({ ...confirmAlone(), radial, mode: UiMode.Radial }, translate)
    expect(view).toMatchObject({ visible: true, layerAlone: false, legend: LegendHost.Radial })
  })

  it('titles the keyboard with the label of its item and takes the language of the layer', () => {
    const view = appView(withLayers(panelsState([TEXT_ITEM], TEXT_ITEM.id), [keyboardLayer]), translate)
    expect(view.layer).toMatchObject({ kind: AppLayerKind.Keyboard, title: TEXT_ITEM.label, view: { itemId: TEXT_ITEM.id } })
    expect(view.layer?.kind === AppLayerKind.Keyboard ? view.layer.view.rows[0]?.[0]?.text : null).toBe('a')
  })

  it('has no title when the item of the keyboard is gone', () => {
    const view = appView(withLayers(panelsState([TEXT_ITEM], TEXT_ITEM.id), [{ ...keyboardLayer, itemId: 'gone' }]), translate)
    expect(view.layer).toMatchObject({ kind: AppLayerKind.Keyboard, title: '' })
  })

  it('shows the top layer when several are stacked', () => {
    const view = appView(withLayers(panelsState([TEXT_ITEM], TEXT_ITEM.id), [keyboardLayer, confirmLayer]), translate)
    expect(view.layer?.kind).toBe(AppLayerKind.Confirm)
  })
})
