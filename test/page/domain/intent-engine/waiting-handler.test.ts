import { describe, expect, it } from 'vitest'
import { transition } from '../../../../src/page/domain/intent-engine'
import { PageCommandType, TimerKind } from '../../../../src/page/domain/page-commands'
import { UiEffectType } from '../../../../src/page/domain/ui-effects'
import type { UiState } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { Intent } from '../../../../src/protocol/intents'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import { ESCAPE_HELD_MODE_CHANGED } from '../../../fixtures/messages'
import { OWNED_GARAGE_RADIAL_ENTRY, OWNED_LIST_PANEL } from '../../../fixtures/owned'
import { initial, NOW, OPEN_RADIAL, openPanel, press, radialEntries, run, sentOf, timerFired } from './engine-helpers'

const NEXT_SEQ = 1
const CANCEL_WAITING = { type: UiEffectType.CancelSchedule, timer: TimerKind.WaitingTimeout }

function waiting(): UiState {
  const state = run(initial(), [radialEntries([OWNED_GARAGE_RADIAL_ENTRY]), OPEN_RADIAL, press(Intent.Confirm)]).state
  expect(state.mode).toBe(UiMode.Waiting)
  return state
}

describe('Waiting', () => {
  it('takes only back, which returns to Idle', () => {
    const state = waiting()
    Object.values(Intent).filter((intent) => intent !== Intent.Back).forEach((intent) => {
      expect(transition(state, press(intent), NOW).state.mode).toBe(UiMode.Waiting)
    })
    expect(transition(state, { type: PageCommandType.PointerAim, vector: { x: 0, y: 1 } }, NOW).state).toBe(state)
    const back = transition(state, press(Intent.Back), NOW)
    expect(back.state.mode).toBe(UiMode.Idle)
    expect(back.effects).toEqual([CANCEL_WAITING, { type: UiEffectType.SendToHost, message: { type: FromPage.ModeChanged, mode: UiMode.Idle } }])
  })

  it('keeps Escape held when back comes from Escape', () => {
    const back = transition(waiting(), press(Intent.Back, true), NOW)
    expect(sentOf(back.effects, FromPage.ModeChanged)).toEqual([ESCAPE_HELD_MODE_CHANGED])
  })

  it('ends with the opening of a panel and cancels its timer', () => {
    const next = transition(waiting(), openPanel(OWNED_LIST_PANEL, NEXT_SEQ), NOW)
    expect(next.state.mode).toBe(UiMode.Panels)
    expect(next.effects).toContainEqual(CANCEL_WAITING)
    expect(sentOf(next.effects, FromPage.ModeChanged)).toEqual([{ type: FromPage.ModeChanged, mode: UiMode.Panels }])
  })

  it('ends at its timeout and returns the focus', () => {
    const next = transition(waiting(), timerFired(TimerKind.WaitingTimeout), NOW)
    expect(next.state.mode).toBe(UiMode.Idle)
    expect(next.effects).toEqual([{ type: UiEffectType.SendToHost, message: { type: FromPage.ModeChanged, mode: UiMode.Idle } }])
  })

  it('ignores a late timeout outside Waiting', () => {
    const state = initial()
    const next = transition(state, timerFired(TimerKind.WaitingTimeout), NOW)
    expect(next.state).toBe(state)
    expect(next.effects).toEqual([])
  })

  it('cancels its timer when the radial is reopened', () => {
    const next = transition(waiting(), OPEN_RADIAL, NOW)
    expect(next.state.mode).toBe(UiMode.Radial)
    expect(next.effects).toContainEqual(CANCEL_WAITING)
  })
})
