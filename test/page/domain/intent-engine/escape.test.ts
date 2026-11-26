import { describe, expect, it } from 'vitest'
import { BACK_HOLD_MS } from '../../../../src/page/domain/hold-detector'
import { transition } from '../../../../src/page/domain/intent-engine'
import { PageCommandType, TimerKind, type UiCommand } from '../../../../src/page/domain/page-commands'
import { UiEffectType } from '../../../../src/page/domain/ui-effects'
import type { UiState } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { Intent } from '../../../../src/protocol/intents'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import { ESCAPE_HELD_MODE_CHANGED } from '../../../fixtures/messages'
import { OWNED_LIST_PANEL, OWNED_WHITELIST_RADIAL_ENTRY } from '../../../fixtures/owned'
import { initial, NOW, OPEN_RADIAL, openPanel, press, radialEntries, run, sentOf, timerFired, withPanels } from './engine-helpers'

const ESCAPE_UP: UiCommand = { type: PageCommandType.EscapeKeyUp }
const NEXT_SEQ = 3

function radialAlone(): UiState {
  return run(initial(), [radialEntries([OWNED_WHITELIST_RADIAL_ENTRY]), OPEN_RADIAL]).state
}

describe('back by Escape at the root of the radial', () => {
  it('closes to Idle and tells the client that Escape is still held', () => {
    const next = transition(radialAlone(), press(Intent.Back, true), NOW)
    expect(next.state.mode).toBe(UiMode.Idle)
    expect(next.state.escapeHeld).toBe(true)
    expect(sentOf(next.effects, FromPage.ModeChanged)).toEqual([ESCAPE_HELD_MODE_CHANGED])
  })

  it('sends EscapeReleased once at the end of the key press', () => {
    const closed = transition(radialAlone(), press(Intent.Back, true), NOW).state
    const released = run(closed, [ESCAPE_UP, ESCAPE_UP])
    expect(released.effects).toEqual([{ type: UiEffectType.SendToHost, message: { type: FromPage.EscapeReleased } }])
    expect(released.state.escapeHeld).toBe(false)
  })

  it('takes no intent while it waits for the end of Escape', () => {
    const closed = transition(radialAlone(), press(Intent.Back, true), NOW).state
    Object.values(Intent).forEach((intent) => {
      expect(transition(closed, press(intent), NOW).state).toBe(closed)
    })
  })

  it('closes without escapeHeld when back comes from the pad, and ignores a later key up', () => {
    const next = transition(radialAlone(), press(Intent.Back), NOW)
    expect(sentOf(next.effects, FromPage.ModeChanged)).toEqual([{ type: FromPage.ModeChanged, mode: UiMode.Idle }])
    expect(transition(next.state, ESCAPE_UP, NOW).effects).toEqual([])
  })

  it('goes back to the panels without escapeHeld when panels are open', () => {
    const over = run(withPanels([OWNED_LIST_PANEL]), [radialEntries([OWNED_WHITELIST_RADIAL_ENTRY]), OPEN_RADIAL]).state
    const next = transition(over, press(Intent.Back, true), NOW)
    expect(sentOf(next.effects, FromPage.ModeChanged)).toEqual([{ type: FromPage.ModeChanged, mode: UiMode.Panels }])
    expect(transition(next.state, ESCAPE_UP, NOW).effects).toEqual([])
  })

  it('stops waiting for Escape when a panel opens or the window loses focus', () => {
    const closed = transition(radialAlone(), press(Intent.Back, true), NOW).state
    expect(transition(closed, openPanel(OWNED_LIST_PANEL, NEXT_SEQ), NOW).state.escapeHeld).toBe(false)
    expect(transition(closed, { type: PageCommandType.WindowBlurred }, NOW).state.escapeHeld).toBe(false)
  })
})

describe('close all by a held Escape', () => {
  it('tells the client that Escape is still held', () => {
    const atChildren = run(withPanels([OWNED_LIST_PANEL]), [radialEntries([OWNED_WHITELIST_RADIAL_ENTRY]), OPEN_RADIAL, press(Intent.Up), press(Intent.Back, true)]).state
    const next = transition(atChildren, timerFired(TimerKind.BackHold), NOW + BACK_HOLD_MS)
    expect(sentOf(next.effects, FromPage.ModeChanged)).toEqual([ESCAPE_HELD_MODE_CHANGED])
    expect(sentOf(run(next.state, [ESCAPE_UP]).effects, FromPage.EscapeReleased)).toHaveLength(1)
  })

  it('does not set escapeHeld when the held back comes from the pad', () => {
    const atChildren = run(withPanels([OWNED_LIST_PANEL]), [radialEntries([OWNED_WHITELIST_RADIAL_ENTRY]), OPEN_RADIAL, press(Intent.Up), press(Intent.Back)]).state
    const next = transition(atChildren, timerFired(TimerKind.BackHold), NOW + BACK_HOLD_MS)
    expect(sentOf(next.effects, FromPage.ModeChanged)).toEqual([{ type: FromPage.ModeChanged, mode: UiMode.Idle }])
  })
})
