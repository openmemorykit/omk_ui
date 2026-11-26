import { CloseReason } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { BACK_HOLD_MS } from '../../../../src/page/domain/hold-detector'
import { transition } from '../../../../src/page/domain/intent-engine'
import { PageCommandType, TimerKind, type UiCommand } from '../../../../src/page/domain/page-commands'
import { REPEAT_DELAY_MS } from '../../../../src/page/domain/repeat-policy'
import { UiEffectType } from '../../../../src/page/domain/ui-effects'
import { RadialLevel, type UiState } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { Intent, IntentPhase } from '../../../../src/protocol/intents'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import { OWNED_ADD_PANEL, OWNED_GARAGE_RADIAL_ENTRY, OWNED_LIST_PANEL, OWNED_WHITELIST_RADIAL_ENTRY } from '../../../fixtures/owned'
import { clientIntent, closedPanels, events, initial, NOW, OPEN_RADIAL, press, radialEntries, release, run, sentOf, timerFired, withPanels } from './engine-helpers'

const FIRST_SEQ = 4
const SECOND_SEQ = 5
const THIRD_SEQ = 6
const EARLY_MS = 200
const BLURRED: UiCommand = { type: PageCommandType.WindowBlurred }
const FOCUSED: UiCommand = { type: PageCommandType.WindowFocused }
const FRAME_TICK: UiCommand = { type: PageCommandType.FrameTick }
const ENTRIES = [OWNED_WHITELIST_RADIAL_ENTRY, OWNED_GARAGE_RADIAL_ENTRY]

function radialOverPanels(): UiState {
  return run(withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL]), [radialEntries(ENTRIES), OPEN_RADIAL]).state
}

describe('client intents and Ack', () => {
  it('records the intent number and acknowledges once per frame with the last number', () => {
    const counted = run(initial(), [clientIntent(FIRST_SEQ, Intent.Down), clientIntent(SECOND_SEQ, Intent.Down, IntentPhase.Release), clientIntent(THIRD_SEQ, Intent.Up)])
    expect(counted.state.lastIntentSeq).toBe(THIRD_SEQ)
    expect(counted.effects).toEqual([])
    const ticked = run(counted.state, [FRAME_TICK, FRAME_TICK])
    expect(ticked.effects).toEqual([{ type: UiEffectType.SendToHost, message: { type: FromPage.Ack, lastIntentSeq: THIRD_SEQ } }])
  })

  it('sends nothing on a frame without intent', () => {
    const state = initial()
    const next = transition(state, FRAME_TICK, NOW)
    expect(next.state).toBe(state)
    expect(next.effects).toEqual([])
  })

  it('ignores an intent number that is not a safe count', () => {
    const next = run(initial(), [clientIntent(Number.NaN, Intent.Down), FRAME_TICK])
    expect(next.effects).toEqual([])
  })
})

describe('pause', () => {
  it('pauses on blur, releases held intents and keeps the rest of the state', () => {
    const holding = run(radialOverPanels(), [press(Intent.Right), press(Intent.Back)]).state
    const next = transition(holding, BLURRED, NOW)
    expect(next.state).toEqual({ ...holding, paused: true, held: [], backHold: { pressedAt: null, fired: false }, backFromEscape: false })
    expect(next.effects).toEqual([{ type: UiEffectType.SendToHost, message: { type: FromPage.Paused, paused: true } }])
  })

  it('ignores every intent while paused and resumes on focus', () => {
    const paused = transition(radialOverPanels(), BLURRED, NOW).state
    const ignored = run(paused, [press(Intent.Right), clientIntent(FIRST_SEQ, Intent.Left), { type: PageCommandType.PointerAim, vector: { x: 1, y: 0 } }])
    expect(ignored.state.radial).toBe(paused.radial)
    expect(ignored.state.mode).toBe(UiMode.Radial)
    const resumed = transition(ignored.state, FOCUSED, NOW)
    expect(resumed.state.paused).toBe(false)
    expect(resumed.effects).toEqual([{ type: UiEffectType.SendToHost, message: { type: FromPage.Paused, paused: false } }])
  })

  it('sends Paused only when the pause changes', () => {
    expect(transition(initial(), FOCUSED, NOW).effects).toEqual([])
    const paused = transition(initial(), BLURRED, NOW).state
    expect(transition(paused, BLURRED, NOW).effects).toEqual([])
  })

  it('does not close everything when the back timer fires during a pause', () => {
    const paused = run(radialOverPanels(), [press(Intent.Back), BLURRED]).state
    const next = transition(paused, timerFired(TimerKind.BackHold), NOW + BACK_HOLD_MS)
    expect(next.state.stack).toBe(paused.stack)
    expect(next.effects).toEqual([])
  })
})

describe('held back', () => {
  it('schedules the hold check when back is pressed, and only then', () => {
    const held = transition(radialOverPanels(), press(Intent.Back), NOW)
    expect(held.state.mode).toBe(UiMode.Panels)
    expect(held.effects).toContainEqual({ type: UiEffectType.Schedule, timer: TimerKind.BackHold, delayMs: BACK_HOLD_MS })
    const confirmed = transition(radialOverPanels(), press(Intent.Confirm), NOW)
    expect(confirmed.effects).toEqual([])
  })

  it('schedules no timer when the press ends in Idle', () => {
    const alone = run(initial(), [radialEntries(ENTRIES), OPEN_RADIAL]).state
    const closed = transition(alone, press(Intent.Back), NOW)
    expect(closed.state.mode).toBe(UiMode.Idle)
    expect(closed.effects).toEqual([{ type: UiEffectType.SendToHost, message: { type: FromPage.ModeChanged, mode: UiMode.Idle } }])
  })

  it('closes every panel and the radial when back is still held after 600 ms', () => {
    const atChildren = run(radialOverPanels(), [press(Intent.Up)]).state
    expect(atChildren.radial.level).toBe(RadialLevel.Children)
    const pressed = run(atChildren, [press(Intent.Back)]).state
    const next = transition(pressed, timerFired(TimerKind.BackHold), NOW + BACK_HOLD_MS)
    expect(next.state.stack).toEqual([])
    expect(next.state.mode).toBe(UiMode.Idle)
    expect(closedPanels(next.effects).map((reply) => reply.reason)).toEqual([CloseReason.CloseAll, CloseReason.CloseAll])
    expect(events(next.effects)).toHaveLength(1)
    expect(sentOf(next.effects, FromPage.ModeChanged)).toEqual([{ type: FromPage.ModeChanged, mode: UiMode.Idle }])
  })

  it('does nothing when back was released before the timer', () => {
    const released = run(radialOverPanels(), [press(Intent.Back), release(Intent.Back)]).state
    const next = transition(released, timerFired(TimerKind.BackHold), NOW + BACK_HOLD_MS)
    expect(next.state).toBe(released)
    expect(next.effects).toEqual([])
  })

  it('checks again later when the timer fires early', () => {
    const atChildren = run(radialOverPanels(), [press(Intent.Up), press(Intent.Back)]).state
    const next = transition(atChildren, timerFired(TimerKind.BackHold), NOW + EARLY_MS)
    expect(next.state.stack).toBe(atChildren.stack)
    expect(next.effects).toEqual([{ type: UiEffectType.Schedule, timer: TimerKind.BackHold, delayMs: BACK_HOLD_MS - EARLY_MS }])
  })

  it('closes everything only once for one hold', () => {
    const atChildren = run(radialOverPanels(), [press(Intent.Up), press(Intent.Back)]).state
    const fired = run(atChildren, [timerFired(TimerKind.BackHold), timerFired(TimerKind.BackHold)], NOW + BACK_HOLD_MS)
    expect(events(fired.effects)).toHaveLength(1)
  })
})

describe('intent bookkeeping', () => {
  it('ignores an orphan release', () => {
    const state = radialOverPanels()
    Object.values(Intent).forEach((intent) => {
      const next = transition(state, release(intent), NOW)
      expect(next.state).toBe(state)
      expect(next.effects).toEqual([])
    })
  })

  it('takes no intent in Idle', () => {
    const state = initial()
    Object.values(Intent).forEach((intent) => {
      expect(transition(state, press(intent), NOW).state).toBe(state)
    })
  })

  it('repeats a held direction when the repeat timer fires, and stops after the release', () => {
    const pressed = transition(radialOverPanels(), press(Intent.Right), NOW)
    expect(pressed.state.radial.sectorIndex).toBe(1)
    expect(pressed.effects).toEqual([{ type: UiEffectType.Schedule, timer: TimerKind.Repeat, delayMs: REPEAT_DELAY_MS }])
    const repeated = transition(pressed.state, timerFired(TimerKind.Repeat), NOW + REPEAT_DELAY_MS)
    expect(repeated.state.radial.sectorIndex).toBe(0)
    expect(repeated.effects).toEqual([expect.objectContaining({ type: UiEffectType.Schedule, timer: TimerKind.Repeat })])
    const released = transition(repeated.state, release(Intent.Right), NOW + REPEAT_DELAY_MS)
    const after = transition(released.state, timerFired(TimerKind.Repeat), NOW + REPEAT_DELAY_MS + REPEAT_DELAY_MS)
    expect(after.state.radial).toBe(released.state.radial)
    expect(after.effects).toEqual([])
  })
})
