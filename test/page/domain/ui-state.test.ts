import { describe, expect, it } from 'vitest'
import { RELEASED_BACK, pressBack } from '../../../src/page/domain/hold-detector'
import { pressHeld } from '../../../src/page/domain/repeat-policy'
import { EMPTY_TOASTS } from '../../../src/page/domain/toasts'
import { THEME_DEFAULTS } from '../../../src/shared/config/config-schema'
import {
  createInitialState,
  DEFAULT_LANGUAGE,
  INITIAL_COMMAND_SEQ,
  INITIAL_INTENT_SEQ,
  RadialLevel,
  releaseIntent,
  UNBOUND_LABELS,
} from '../../../src/page/domain/ui-state'
import { Intent, Modality } from '../../../src/protocol/intents'
import { GlyphSet, UiMode } from '../../../src/protocol/page-vocabulary'

const PRESSED_AT = 1000

describe('createInitialState', () => {
  it('starts idle with an empty stack and default settings', () => {
    expect(createInitialState()).toEqual({
      mode: UiMode.Idle,
      paused: false,
      modality: Modality.KeyboardMouse,
      stack: [],
      appliedCommandSeq: INITIAL_COMMAND_SEQ,
      radial: { entries: [], level: RadialLevel.Sectors, sectorIndex: 0, childIndex: null },
      toasts: EMPTY_TOASTS,
      prompt: null,
      held: [],
      backHold: RELEASED_BACK,
      backFromEscape: false,
      lastIntentSeq: INITIAL_INTENT_SEQ,
      ackPending: false,
      escapeHeld: false,
      glyphSet: GlyphSet.Xbox,
      settings: THEME_DEFAULTS,
      binding: UNBOUND_LABELS,
      language: DEFAULT_LANGUAGE,
    })
  })

  it('returns a fresh state each time', () => {
    const first = createInitialState()
    expect(createInitialState()).not.toBe(first)
    expect(createInitialState().stack).not.toBe(first.stack)
  })
})

describe('releaseIntent', () => {
  it('ignores a release without a prior press and keeps the same state', () => {
    const state = createInitialState()
    Object.values(Intent).forEach((intent) => {
      expect(releaseIntent(state, intent)).toBe(state)
    })
    expect(releaseIntent(state, 'unknown' as Intent)).toBe(state)
  })

  it('ignores a release of another intent than the held one', () => {
    const state = { ...createInitialState(), held: pressHeld([], Intent.Up, PRESSED_AT) }
    expect(releaseIntent(state, Intent.Down)).toBe(state)
  })

  it('releases a held direction', () => {
    const state = { ...createInitialState(), held: pressHeld([], Intent.Up, PRESSED_AT) }
    expect(releaseIntent(state, Intent.Up).held).toEqual([])
  })

  it('releases a pressed back', () => {
    const state = { ...createInitialState(), backHold: pressBack(PRESSED_AT) }
    expect(releaseIntent(state, Intent.Back).backHold).toBe(RELEASED_BACK)
    expect(releaseIntent(state, Intent.Confirm)).toBe(state)
  })
})
