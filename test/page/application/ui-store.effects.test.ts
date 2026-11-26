import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FromPage } from '../../../src/protocol/from-page'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { createUiStore } from '../../../src/page/application/ui-store'
import { AnnounceUrgency } from '../../../src/page/application/ports'
import { PageCommandType, TimerKind, type UiCommand } from '../../../src/page/domain/page-commands'
import { Announcement, UiEffectType, type Transition, type UiEffect } from '../../../src/page/domain/ui-effects'
import type { UiState } from '../../../src/page/domain/ui-state'
import { createFakes, type Fakes } from './fakes'

type TransitionFn = (state: UiState, command: UiCommand, now: number) => Transition
const scripted = vi.hoisted(() => ({ transition: null as unknown as TransitionFn }))

vi.mock('../../../src/page/domain/intent-engine', () => ({
  transition: (state: UiState, command: UiCommand, now: number) => scripted.transition(state, command, now),
}))

const NOW = 1_000
const LATE = 500
const SECOND = 2
const ERROR_COUNT = 2
const PAINT_DELAY = 12
const REPEAT_DELAY = 320
const TICK: UiCommand = { type: PageCommandType.FrameTick }

function script(effects: readonly UiEffect[] = [], ackPending = false): void {
  scripted.transition = (state) => ({ state: { ...state, ackPending, lastIntentSeq: state.lastIntentSeq + 1 }, effects })
}

let fakes: Fakes

beforeEach(() => {
  fakes = createFakes()
  fakes.time.now = NOW
  script()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('effects', () => {
  it('SendToHost sends the message through the host', () => {
    script([{ type: UiEffectType.SendToHost, message: { type: FromPage.Ready } }])
    createUiStore(fakes.ports).dispatch(TICK)
    expect(fakes.sent).toEqual([{ type: FromPage.Ready }])
  })

  it('Schedule asks the scheduler, and firing dispatches TimerFired', () => {
    const seen: UiCommand[] = []
    script([{ type: UiEffectType.Schedule, timer: TimerKind.Repeat, delayMs: REPEAT_DELAY }])
    const store = createUiStore(fakes.ports)
    store.dispatch(TICK)
    expect(fakes.scheduled).toEqual([{ timer: TimerKind.Repeat, delayMs: REPEAT_DELAY }])
    scripted.transition = (state, command) => {
      seen.push(command)
      return { state, effects: [] }
    }
    fakes.timers.get(TimerKind.Repeat)?.fire()
    expect(seen).toEqual([{ type: PageCommandType.TimerFired, timer: TimerKind.Repeat }])
  })

  it('two Schedule effects of the same kind leave one timer, the second', () => {
    const first = 100
    const second = 200
    script([
      { type: UiEffectType.Schedule, timer: TimerKind.BackHold, delayMs: first },
      { type: UiEffectType.Schedule, timer: TimerKind.BackHold, delayMs: second },
    ])
    createUiStore(fakes.ports).dispatch(TICK)
    expect(fakes.timers.size).toBe(1)
    expect(fakes.timers.get(TimerKind.BackHold)?.delayMs).toBe(second)
  })

  it('Schedule of different kinds keeps one timer each', () => {
    script([
      { type: UiEffectType.Schedule, timer: TimerKind.BackHold, delayMs: 1 },
      { type: UiEffectType.Schedule, timer: TimerKind.Repeat, delayMs: 1 },
    ])
    createUiStore(fakes.ports).dispatch(TICK)
    expect([...fakes.timers.keys()].sort()).toEqual([TimerKind.BackHold, TimerKind.Repeat])
  })

  it('CancelSchedule cancels that timer', () => {
    script([{ type: UiEffectType.CancelSchedule, timer: TimerKind.FormTimeout }])
    createUiStore(fakes.ports).dispatch(TICK)
    expect(fakes.cancelled).toEqual([TimerKind.FormTimeout])
  })

  it('Announce translates and announces politely', () => {
    script([{ type: UiEffectType.Announce, announcement: Announcement.PanelOpened, params: { title: 'Garage' } }])
    createUiStore(fakes.ports).dispatch(TICK)
    expect(fakes.announced).toEqual([{ text: 'ui.announce.panelOpened|{"title":"Garage"}', urgency: AnnounceUrgency.Polite }])
  })

  it('Announce of form errors is assertive', () => {
    script([{ type: UiEffectType.Announce, announcement: Announcement.FormErrors, params: { count: ERROR_COUNT } }])
    createUiStore(fakes.ports).dispatch(TICK)
    expect(fakes.announced).toEqual([{ text: `ui.announce.formErrors|{"count":${ERROR_COUNT}}`, urgency: AnnounceUrgency.Assertive }])
  })

  it('FocusTextInput focuses the item through the port', () => {
    script([{ type: UiEffectType.FocusTextInput, itemId: 'name' }])
    createUiStore(fakes.ports).dispatch(TICK)
    expect(fakes.focused).toEqual(['name'])
  })

  it('MeasurePaint sends a PanelPainted trace measured from the reception', () => {
    script([{ type: UiEffectType.MeasurePaint, panelId: 'list' }])
    createUiStore(fakes.ports).dispatch(TICK)
    expect(fakes.sent).toEqual([])
    fakes.time.now = NOW + LATE
    fakes.paints[0]?.(NOW + PAINT_DELAY)
    expect(fakes.sent).toEqual([{ type: FromPage.Trace, kind: ReportKind.PanelPainted, data: { panelId: 'list', durationMs: PAINT_DELAY } }])
  })
})

describe('frame requests', () => {
  it('requests no frame while no ack is pending', () => {
    createUiStore(fakes.ports).dispatch(TICK)
    expect(fakes.frames).toHaveLength(0)
  })

  it('requests one frame for several commands in the same frame', () => {
    script([], true)
    const store = createUiStore(fakes.ports)
    store.dispatch(TICK)
    store.dispatch(TICK)
    store.dispatch(TICK)
    expect(fakes.frames).toHaveLength(1)
  })

  it('dispatches FrameTick when the frame fires, then allows a new request', () => {
    const seen: UiCommand[] = []
    script([], true)
    const store = createUiStore(fakes.ports)
    store.dispatch(TICK)
    scripted.transition = (state, command) => {
      seen.push(command)
      return { state: { ...state, ackPending: false }, effects: [] }
    }
    fakes.frames[0]?.()
    expect(seen).toEqual([TICK])
    script([], true)
    store.dispatch(TICK)
    expect(fakes.frames).toHaveLength(SECOND)
  })
})
