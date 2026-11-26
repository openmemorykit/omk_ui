import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FromPage } from '../../../src/protocol/from-page'
import { createUiStore } from '../../../src/page/application/ui-store'
import { PageCommandType, TimerKind, type UiCommand } from '../../../src/page/domain/page-commands'
import { UiEffectType, type Transition, type UiEffect } from '../../../src/page/domain/ui-effects'
import { createInitialState, type UiState } from '../../../src/page/domain/ui-state'
import { TO_PAGE_SAMPLES } from '../../fixtures/messages'
import { ToPage } from '../../../src/protocol/to-page'
import { createFakes, type Fakes } from './fakes'

type TransitionFn = (state: UiState, command: UiCommand, now: number) => Transition
const scripted = vi.hoisted(() => ({ transition: null as unknown as TransitionFn }))

vi.mock('../../../src/page/domain/intent-engine', () => ({
  transition: (state: UiState, command: UiCommand, now: number) => scripted.transition(state, command, now),
}))

const NOW = 1_000
const SECOND = 2
const TICK: UiCommand = { type: PageCommandType.FrameTick }
const MARKER = { ...createInitialState(), lastIntentSeq: 7 }

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

describe('dispatch', () => {
  it('passes the clock reading to transition and replaces the state', () => {
    const seen: number[] = []
    scripted.transition = (state, _command, now) => {
      seen.push(now)
      return { state: MARKER, effects: [] }
    }
    const store = createUiStore(fakes.ports)
    store.dispatch(TICK)
    expect(seen).toEqual([NOW])
    expect(store.state()).toBe(MARKER)
  })

  it('starts from the given initial state', () => {
    expect(createUiStore(fakes.ports, MARKER).state()).toBe(MARKER)
  })

  it('notifies subscribers once with the new state, before the effects run', () => {
    const order: string[] = []
    script([{ type: UiEffectType.FocusTextInput, itemId: 'a' }])
    const store = createUiStore({ ...fakes.ports, textFocus: { focus: () => void order.push('effect') } })
    store.subscribe((state) => void order.push(`listener:${state.lastIntentSeq}`))
    store.dispatch(TICK)
    expect(order).toEqual(['listener:1', 'effect'])
  })

  it('stops notifying after unsubscribe', () => {
    const store = createUiStore(fakes.ports)
    const listener = vi.fn()
    const stop = store.subscribe(listener)
    stop()
    store.dispatch(TICK)
    expect(listener).not.toHaveBeenCalled()
  })

  it('runs the effects in order', () => {
    const order: string[] = []
    script([
      { type: UiEffectType.FocusTextInput, itemId: 'one' },
      { type: UiEffectType.CancelSchedule, timer: TimerKind.Repeat },
      { type: UiEffectType.FocusTextInput, itemId: 'two' },
    ])
    const store = createUiStore({
      ...fakes.ports,
      textFocus: { focus: (id) => void order.push(id) },
      scheduler: { schedule: () => undefined, cancel: () => void order.push('cancel') },
    })
    store.dispatch(TICK)
    expect(order).toEqual(['one', 'cancel', 'two'])
  })

  it('keeps going when a subscriber throws', () => {
    script([{ type: UiEffectType.FocusTextInput, itemId: 'x' }])
    const store = createUiStore(fakes.ports)
    const after = vi.fn()
    store.subscribe(() => {
      throw new Error('subscriber')
    })
    store.subscribe(after)
    expect(() => store.dispatch(TICK)).not.toThrow()
    expect(after).toHaveBeenCalledTimes(1)
    expect(fakes.focused).toEqual(['x'])
  })

  it('keeps running the remaining effects when one port throws', () => {
    script([
      { type: UiEffectType.FocusTextInput, itemId: 'x' },
      { type: UiEffectType.CancelSchedule, timer: TimerKind.Repeat },
    ])
    const store = createUiStore({
      ...fakes.ports,
      textFocus: {
        focus: () => {
          throw new Error('port')
        },
      },
    })
    expect(() => store.dispatch(TICK)).not.toThrow()
    expect(fakes.cancelled).toEqual([TimerKind.Repeat])
  })

  it('queues a dispatch made during a dispatch and processes it afterwards', () => {
    const log: string[] = []
    const store = createUiStore(fakes.ports)
    scripted.transition = (state, command) => {
      log.push(`transition:${command.type}`)
      return { state: { ...state, lastIntentSeq: state.lastIntentSeq + 1 }, effects: [] }
    }
    store.subscribe((state) => {
      log.push(`listener:${state.lastIntentSeq}`)
      if (state.lastIntentSeq === 1) store.dispatch({ type: PageCommandType.WindowBlurred })
    })
    store.dispatch(TICK)
    expect(log).toEqual([`transition:${PageCommandType.FrameTick}`, 'listener:1', `transition:${PageCommandType.WindowBlurred}`, 'listener:2'])
    expect(store.state().lastIntentSeq).toBe(SECOND)
  })

  it('queues a dispatch made by an effect after the remaining effects', () => {
    const order: string[] = []
    let first = true
    scripted.transition = (state) => {
      const effects: UiEffect[] = first
        ? [
            { type: UiEffectType.SendToHost, message: { type: FromPage.Ready } },
            { type: UiEffectType.FocusTextInput, itemId: 'later' },
          ]
        : []
      first = false
      return { state, effects }
    }
    const store = createUiStore({
      ...fakes.ports,
      host: { ...fakes.ports.host, send: () => store.dispatch(TICK) },
      textFocus: { focus: () => void order.push('focus') },
    })
    store.subscribe(() => void order.push('state'))
    store.dispatch(TICK)
    expect(order).toEqual(['state', 'focus', 'state'])
  })

  it('recovers after a transition that throws', () => {
    const store = createUiStore(fakes.ports)
    scripted.transition = () => {
      throw new Error('domain')
    }
    expect(() => store.dispatch(TICK)).toThrow()
    script()
    store.dispatch(TICK)
    expect(store.state().lastIntentSeq).toBe(1)
  })
})

describe('boot', () => {
  it('loads the locale into the translator before the transition', () => {
    const order: string[] = []
    const store = createUiStore({ ...fakes.ports, translator: { ...fakes.ports.translator, load: () => void order.push('load') } })
    scripted.transition = (state) => {
      order.push('transition')
      return { state, effects: [] }
    }
    store.dispatch(TO_PAGE_SAMPLES[ToPage.Boot])
    expect(order).toEqual(['load', 'transition'])
  })

  it('hands the locale bundle of the boot message to the translator', () => {
    const store = createUiStore(fakes.ports)
    store.dispatch(TO_PAGE_SAMPLES[ToPage.Boot])
    expect(fakes.loaded).toEqual([TO_PAGE_SAMPLES[ToPage.Boot].locale])
  })

  it('does not load a locale for other commands', () => {
    createUiStore(fakes.ports).dispatch(TICK)
    expect(fakes.loaded).toEqual([])
  })
})

