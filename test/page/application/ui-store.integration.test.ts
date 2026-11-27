import { beforeEach, describe, expect, it } from 'vitest'
import { FromPage } from '../../../src/protocol/from-page'
import { Intent, IntentPhase, InputSource } from '../../../src/protocol/intents'
import { ToPage, type ToPageMessageOf } from '../../../src/protocol/to-page'
import type { UiStore } from '../../../src/page/application/ports'
import { createUiStore } from '../../../src/page/application/ui-store'
import { PageCommandType, TimerKind } from '../../../src/page/domain/page-commands'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { TO_PAGE_SAMPLES } from '../../fixtures/messages'
import { SHARED_STACK_OWNED, SHARED_STACK_SEQ } from '../../fixtures/stack'
import { createFakes, type Fakes } from './fakes'

const FIRST_SEQ = 1
const SECOND_SEQ = 2
const THIRD_SEQ = 3

let fakes: Fakes

function intent(seq: number, direction: Intent, phase: IntentPhase): ToPageMessageOf<typeof ToPage.Intent> {
  return { type: ToPage.Intent, seq, intent: direction, phase, source: InputSource.Pad }
}

beforeEach(() => {
  fakes = createFakes()
})

function openedStore(): UiStore {
  const store = createUiStore(fakes.ports)
  store.dispatch({ ...TO_PAGE_SAMPLES[ToPage.Boot], panels: [], commandSeq: 0 })
  store.dispatch({ type: ToPage.OpenPanel, commandSeq: SHARED_STACK_SEQ.Open, panel: SHARED_STACK_OWNED[0] })
  return store
}

describe('store with the real domain', () => {
  it('measures the paint and announces when a panel opens', () => {
    const store = openedStore()
    expect(store.state().mode).toBe(UiMode.Panels)
    expect(fakes.paints).toHaveLength(1)
    expect(fakes.announced).toHaveLength(1)
    expect(fakes.announced[0]?.text).toContain(SHARED_STACK_OWNED[0].panel.title)
    fakes.paints[0]?.(0)
    expect(fakes.sent.some((message) => message.type === FromPage.Trace)).toBe(true)
  })

  it('sends a single Ack for several intents received in one frame', () => {
    const store = openedStore()
    fakes.sent.length = 0
    store.dispatch(intent(FIRST_SEQ, Intent.Down, IntentPhase.Press))
    store.dispatch(intent(SECOND_SEQ, Intent.Down, IntentPhase.Release))
    store.dispatch(intent(THIRD_SEQ, Intent.Down, IntentPhase.Press))
    expect(fakes.frames).toHaveLength(1)
    fakes.frames[0]?.()
    const acks = fakes.sent.filter((message) => message.type === FromPage.Ack)
    expect(acks).toEqual([{ type: FromPage.Ack, lastIntentSeq: THIRD_SEQ }])
  })

  it('schedules a single repeat timer for a held direction', () => {
    const store = openedStore()
    store.dispatch(intent(FIRST_SEQ, Intent.Down, IntentPhase.Press))
    store.dispatch(intent(SECOND_SEQ, Intent.Down, IntentPhase.Press))
    expect(fakes.timers.has(TimerKind.Repeat)).toBe(true)
    expect([...fakes.timers.keys()].filter((timer) => timer === TimerKind.Repeat)).toHaveLength(1)
  })

  it('cancels nothing when a held direction is released', () => {
    const store = openedStore()
    store.dispatch(intent(FIRST_SEQ, Intent.Down, IntentPhase.Press))
    store.dispatch(intent(SECOND_SEQ, Intent.Down, IntentPhase.Release))
    expect(fakes.cancelled).toEqual([])
  })

  it('feeds a fired timer back into the domain', () => {
    const store = openedStore()
    store.dispatch(intent(FIRST_SEQ, Intent.Down, IntentPhase.Press))
    const before = store.state()
    fakes.time.now += 1_000
    fakes.timers.get(TimerKind.Repeat)?.fire()
    expect(store.state()).not.toBe(before)
    store.dispatch({ type: PageCommandType.FrameTick })
  })
})
