import type { ValueOf } from '@openmemorykit/core/shared'
import { LayerKind, type Layer, type UiState } from '../../domain/ui-state'
import type { Translate } from '../../i18n/messages'
import { columnView } from './column-view'
import { confirmView, type ConfirmView } from './confirm-view'
import { keyboardView, type KeyboardView } from './keyboard-view'
import { promptView } from './prompt-view'
import { radialView } from './radial-view'
import { toastsView } from './toast-view'

export const AppLayerKind = { Confirm: 'confirm', Keyboard: 'keyboard' } as const
export type AppLayerKind = ValueOf<typeof AppLayerKind>

export const LegendHost = { None: 'none', Column: 'column', Radial: 'radial' } as const
export type LegendHost = ValueOf<typeof LegendHost>

export type AppLayer =
  | { readonly kind: typeof AppLayerKind.Confirm; readonly view: ConfirmView }
  | { readonly kind: typeof AppLayerKind.Keyboard; readonly view: KeyboardView; readonly title: string }

export interface AppView {
  readonly lang: string
  readonly visible: boolean
  readonly layer: AppLayer | null
  readonly layerAlone: boolean
  readonly legend: LegendHost
}

const NEXT = 1
const NO_TITLE = ''

function layerOf(state: UiState, translate: Translate): AppLayer | null {
  const frame = state.stack[state.stack.length - NEXT]
  const layer: Layer | undefined = frame?.layers[frame.layers.length - NEXT]
  if (frame === undefined || layer === undefined) return null
  if (layer.kind === LayerKind.Confirm) return Object.freeze({ kind: AppLayerKind.Confirm, view: confirmView(layer, translate) })
  const title = frame.panel?.panel.items.find((item) => item.id === layer.itemId)?.label ?? NO_TITLE
  return Object.freeze({ kind: AppLayerKind.Keyboard, view: keyboardView(layer, layer.keyboard.language, translate), title })
}

function legendHostOf(column: boolean, radial: boolean): LegendHost {
  if (radial) return LegendHost.Radial
  return column ? LegendHost.Column : LegendHost.None
}

export function appView(state: UiState, translate: Translate): AppView {
  const column = columnView(state, translate) !== null
  const radial = radialView(state, translate) !== null
  const layer = layerOf(state, translate)
  const layerAlone = !column && layer !== null
  const visible = column || radial || layerAlone || toastsView(state, translate).toasts.length > 0 || promptView(state, translate) !== null
  return Object.freeze({ lang: state.language, visible, layer, layerAlone, legend: legendHostOf(column, radial) })
}
