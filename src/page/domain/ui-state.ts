import type { ValueOf } from '@openmemorykit/core/shared'
import type { ConfirmContent } from '@openmemorykit/ui/contract'
import { THEME_DEFAULTS, type ThemeConfig } from '../../shared/config/config-schema'
import { Intent, Modality } from '../../protocol/intents'
import type { OwnedPanel, OwnedPrompt, OwnedRadialEntry } from '../../protocol/owned'
import { GlyphSet, UiMode, type PromptState } from '../../protocol/page-vocabulary'
import type { BindingLabels } from '../../protocol/to-page'
import type { FormState } from './form'
import { RELEASED_BACK, type BackHold } from './hold-detector'
import { KeyboardLanguage } from './keyboard-layouts'
import { releaseHeld, type HeldIntents } from './repeat-policy'
import { EMPTY_TOASTS, type ToastQueue } from './toasts'
import type { KeyboardState } from './virtual-keyboard'

export const LayerKind = { Keyboard: 'keyboard', Confirm: 'confirm' } as const
export type LayerKind = ValueOf<typeof LayerKind>
export const ConfirmChoice = { Confirm: 'confirm', Cancel: 'cancel' } as const
export type ConfirmChoice = ValueOf<typeof ConfirmChoice>
export const ConfirmOrigin = { Request: 'request', Item: 'item', AbandonText: 'abandonText' } as const
export type ConfirmOrigin = ValueOf<typeof ConfirmOrigin>

export interface VirtualKeyboardLayer {
  readonly kind: typeof LayerKind.Keyboard
  readonly itemId: string
  readonly initialValue: string
  readonly keyboard: KeyboardState
}

export interface ConfirmLayer {
  readonly kind: typeof LayerKind.Confirm
  readonly origin: ValueOf<typeof ConfirmOrigin>
  readonly content: ConfirmContent
  readonly confirmId: string | null
  readonly itemId: string | null
  readonly choice: ValueOf<typeof ConfirmChoice>
}

export type Layer = VirtualKeyboardLayer | ConfirmLayer

export interface Frame {
  readonly panel: OwnedPanel | null
  readonly focusItemId: string | null
  readonly layers: readonly Layer[]
  readonly form: FormState | null
  readonly pendingItemId: string | null
  readonly visibleStart: number
}

export const RadialLevel = { Sectors: 1, Children: 2 } as const
export type RadialLevel = ValueOf<typeof RadialLevel>

export interface RadialState {
  readonly entries: readonly OwnedRadialEntry[]
  readonly level: ValueOf<typeof RadialLevel>
  readonly sectorIndex: number
  readonly childIndex: number | null
}

export interface PromptView { readonly prompt: OwnedPrompt; readonly state: PromptState | null; readonly holdMs: number }

export interface UiState {
  readonly mode: UiMode
  readonly paused: boolean
  readonly modality: Modality
  readonly stack: readonly Frame[]
  readonly appliedCommandSeq: number
  readonly radial: RadialState
  readonly toasts: ToastQueue
  readonly prompt: PromptView | null
  readonly held: HeldIntents
  readonly backHold: BackHold
  readonly lastIntentSeq: number
  readonly ackPending: boolean
  readonly escapeHeld: boolean
  readonly glyphSet: GlyphSet
  readonly settings: ThemeConfig
  readonly binding: BindingLabels
  readonly language: string
}

export const INITIAL_COMMAND_SEQ = 0
export const INITIAL_INTENT_SEQ = 0
export const DEFAULT_LANGUAGE: string = KeyboardLanguage.English
export const UNBOUND_LABELS: BindingLabels = Object.freeze({ radial: '', interact: '', pushToTalk: '' })

const FIRST_SECTOR = 0

export function createInitialState(): UiState {
  return {
    mode: UiMode.Idle,
    paused: false,
    modality: Modality.KeyboardMouse,
    stack: [],
    appliedCommandSeq: INITIAL_COMMAND_SEQ,
    radial: { entries: [], level: RadialLevel.Sectors, sectorIndex: FIRST_SECTOR, childIndex: null },
    toasts: EMPTY_TOASTS,
    prompt: null,
    held: [],
    backHold: RELEASED_BACK,
    lastIntentSeq: INITIAL_INTENT_SEQ,
    ackPending: false,
    escapeHeld: false,
    glyphSet: GlyphSet.Xbox,
    settings: { ...THEME_DEFAULTS },
    binding: UNBOUND_LABELS,
    language: DEFAULT_LANGUAGE,
  }
}

export function releaseIntent(state: UiState, intent: Intent): UiState {
  const held = releaseHeld(state.held, intent)
  const releasesBack = intent === Intent.Back && state.backHold.pressedAt !== null
  if (held === state.held && !releasesBack) return state
  return { ...state, held, backHold: releasesBack ? RELEASED_BACK : state.backHold }
}
