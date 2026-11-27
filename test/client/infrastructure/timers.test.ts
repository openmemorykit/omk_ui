import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { armTimer, TimerOperation } from '../../../src/client/infrastructure/timers'

const DELAY_MS = 3000

let natives: NativeRecorder | null = null
let scheduled: Array<() => void> = []

function install(setTimeoutImplementation?: (...args: never[]) => unknown): void {
  scheduled = []
  natives = installNatives({
    setTimeout: setTimeoutImplementation ?? ((callback: () => void) => {
      scheduled.push(callback)
      return 1
    }),
  })
}

afterEach(() => {
  natives?.restore()
  natives = null
})

describe('armTimer', () => {
  it('arms one setTimeout with the delay and does not call the handler before it elapses', () => {
    install()
    const onElapsed = vi.fn()
    armTimer(DELAY_MS, onElapsed, vi.fn())
    expect(natives?.callsOf('setTimeout').map(([, delay]) => delay)).toEqual([DELAY_MS])
    expect(onElapsed).not.toHaveBeenCalled()
  })

  it('calls the handler once when the timer elapses', () => {
    install()
    const onElapsed = vi.fn()
    armTimer(DELAY_MS, onElapsed, vi.fn())
    scheduled.forEach((callback) => callback())
    expect(onElapsed).toHaveBeenCalledTimes(1)
  })

  it('keeps a failing handler out of the timer and reports it', () => {
    install()
    const failure = new Error('handler broke')
    const onFailure = vi.fn()
    armTimer(DELAY_MS, () => { throw failure }, onFailure)
    expect(() => scheduled.forEach((callback) => callback())).not.toThrow()
    expect(onFailure).toHaveBeenCalledWith(TimerOperation.Elapsed, failure)
  })

  it('keeps a failing setTimeout out of the caller and reports it', () => {
    const failure = new Error('setTimeout broke')
    install(() => { throw failure })
    const onFailure = vi.fn()
    expect(() => armTimer(DELAY_MS, vi.fn(), onFailure)).not.toThrow()
    expect(onFailure).toHaveBeenCalledWith(TimerOperation.Arm, failure)
  })
})
