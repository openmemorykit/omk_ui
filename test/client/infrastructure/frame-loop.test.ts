import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFrameLoops, FrameLoopOperation } from '../../../src/client/infrastructure/frame-loop'

const PUMP_HANDLE = 11
const IDLE_HANDLE = 12

let natives: NativeRecorder
let tasks: Array<() => void>

function install(): void {
  tasks = []
  const handles = [PUMP_HANDLE, IDLE_HANDLE]
  natives = installNatives({
    setTick: (task: () => void) => {
      tasks.push(task)
      return handles[tasks.length - 1]
    },
    clearTick: () => undefined,
  })
}

afterEach(() => natives.restore())

describe('frame loops', () => {
  it('runs the pump and the idle tick as two separate ticks', () => {
    install()
    const onPumpFrame = vi.fn()
    const onIdleFrame = vi.fn()
    const loops = createFrameLoops({ onPumpFrame, onIdleFrame, onFailure: vi.fn() })
    loops.pump.start()
    loops.idle.start()
    tasks.forEach((task) => task())
    expect(onPumpFrame).toHaveBeenCalledTimes(1)
    expect(onIdleFrame).toHaveBeenCalledTimes(1)
    expect([loops.pump.isRunning(), loops.idle.isRunning()]).toEqual([true, true])
  })

  it('calls clearTick with the tick handle on stop, and only once', () => {
    install()
    const loops = createFrameLoops({ onPumpFrame: vi.fn(), onIdleFrame: vi.fn(), onFailure: vi.fn() })
    loops.pump.start()
    loops.pump.stop()
    loops.pump.stop()
    expect(natives.callsOf('clearTick')).toEqual([[PUMP_HANDLE]])
    expect(loops.pump.isRunning()).toBe(false)
  })

  it('does not stack a second tick when started twice', () => {
    install()
    const loops = createFrameLoops({ onPumpFrame: vi.fn(), onIdleFrame: vi.fn(), onFailure: vi.fn() })
    loops.idle.start()
    loops.idle.start()
    expect(natives.callsOf('setTick')).toHaveLength(1)
  })

  it('keeps an exception out of the tick and reports which loop failed', () => {
    install()
    const failure = new Error('frame broke')
    const onFailure = vi.fn()
    const loops = createFrameLoops({ onPumpFrame: () => { throw failure }, onIdleFrame: vi.fn(), onFailure })
    loops.pump.start()
    expect(() => tasks[0]?.()).not.toThrow()
    expect(onFailure).toHaveBeenCalledWith(FrameLoopOperation.Pump, failure)
    expect(loops.pump.isRunning()).toBe(true)
  })

  it('names the idle loop when it is the idle tick that fails', () => {
    install()
    const failure = new Error('idle broke')
    const onFailure = vi.fn()
    const loops = createFrameLoops({ onPumpFrame: vi.fn(), onIdleFrame: () => { throw failure }, onFailure })
    loops.idle.start()
    tasks[0]?.()
    expect(onFailure).toHaveBeenCalledWith(FrameLoopOperation.Idle, failure)
  })

  it('keeps going when the failure reporter itself throws', () => {
    install()
    const loops = createFrameLoops({ onPumpFrame: vi.fn(), onIdleFrame: () => { throw new Error('boom') }, onFailure: () => { throw new Error('reporter') } })
    loops.idle.start()
    expect(() => tasks[0]?.()).not.toThrow()
  })
})
