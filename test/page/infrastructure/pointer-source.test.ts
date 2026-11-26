import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Intent, IntentPhase } from '../../../src/protocol/intents'
import { PageCommandType, type UiCommand } from '../../../src/page/domain/page-commands'
import { createPointerSource, MAX_WHEEL_STEPS_PER_EVENT, WHEEL_NOTCH_PX, type PointerSourceState } from '../../../src/page/infrastructure/input/pointer-source'
import { trackListeners, type ListenerLedger } from './ledger'

const THREE = 3
const SMALL = 25
const MEDIUM = 30
const TINY = 10
const FOUR = 4
const TWO = 2

const BASE: PointerSourceState = { radialBinding: 'b_102' }

function tap(intent: Intent): UiCommand[] {
  return [
    { type: PageCommandType.LocalIntent, intent, phase: IntentPhase.Press, fromEscape: false },
    { type: PageCommandType.LocalIntent, intent, phase: IntentPhase.Release, fromEscape: false },
  ]
}

function wheel(deltaY: number, deltaMode = 0): void {
  window.dispatchEvent(new WheelEvent('wheel', { deltaY, deltaMode, cancelable: true }))
}

describe('pointer source', () => {
  let commands: UiCommand[]
  let state: PointerSourceState
  let ledger: ListenerLedger
  let detach: () => void

  beforeEach(() => {
    commands = []
    state = BASE
    ledger = trackListeners(window)
    detach = createPointerSource(window, (command) => void commands.push(command), () => state)
  })
  afterEach(() => {
    detach()
    ledger.restore()
  })

  it('gives one step per 40 px, three for 120 px', () => {
    wheel(THREE * WHEEL_NOTCH_PX)
    expect(commands).toEqual([...tap(Intent.Down), ...tap(Intent.Down), ...tap(Intent.Down)])
  })

  it('goes up on a negative delta', () => {
    wheel(-WHEEL_NOTCH_PX)
    expect(commands).toEqual(tap(Intent.Up))
  })

  it('accumulates small deltas across events', () => {
    wheel(SMALL)
    expect(commands).toEqual([])
    wheel(SMALL)
    expect(commands).toEqual(tap(Intent.Down))
    wheel(MEDIUM)
    expect(commands).toEqual([...tap(Intent.Down), ...tap(Intent.Down)])
    wheel(TINY)
    expect(commands).toHaveLength(FOUR)
  })

  it('drops the remainder when the direction flips', () => {
    wheel(MEDIUM)
    wheel(-MEDIUM)
    expect(commands).toEqual([])
    wheel(-TINY)
    expect(commands).toEqual(tap(Intent.Up))
  })

  it('counts a line-mode delta as one step per line', () => {
    wheel(TWO, 1)
    expect(commands).toEqual([...tap(Intent.Down), ...tap(Intent.Down)])
  })

  it('bounds the steps of a single huge wheel event', () => {
    wheel(Number.MAX_SAFE_INTEGER)
    expect(commands.length).toBeLessThanOrEqual(MAX_WHEEL_STEPS_PER_EVENT * TWO)
    expect(commands.length).toBeGreaterThan(0)
  })

  it('ignores a non-finite delta', () => {
    wheel(Number.NaN)
    wheel(Number.POSITIVE_INFINITY)
    expect(commands).toEqual([])
  })

  it('turns a right click into back and removes the native menu', () => {
    const event = new MouseEvent('contextmenu', { cancelable: true })
    window.dispatchEvent(event)
    expect(commands).toEqual(tap(Intent.Back))
    expect(event.defaultPrevented).toBe(true)
  })

  it('turns a middle click into radial when the binding is b_102', () => {
    window.dispatchEvent(new MouseEvent('mousedown', { button: 1, cancelable: true }))
    expect(commands).toEqual(tap(Intent.Radial))
  })

  it('does not open the radial from a middle click for another binding', () => {
    state = { ...BASE, radialBinding: 't_f' }
    window.dispatchEvent(new MouseEvent('mousedown', { button: 1, cancelable: true }))
    expect(commands).toEqual([{ type: PageCommandType.LocalModality }])
  })

  it('leaves a left click to the components, radial open or not', () => {
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0, cancelable: true }))
    expect(commands).toEqual([{ type: PageCommandType.LocalModality }])
  })

  it('reports the modality on mouse movement', () => {
    window.dispatchEvent(new MouseEvent('mousemove'))
    expect(commands).toEqual([{ type: PageCommandType.LocalModality }])
  })

  it('removes every listener on detach', () => {
    expect(ledger.active()).toBeGreaterThan(0)
    detach()
    expect(ledger.active()).toBe(0)
    wheel(WHEEL_NOTCH_PX)
    window.dispatchEvent(new MouseEvent('mousemove'))
    expect(commands).toEqual([])
  })
})
