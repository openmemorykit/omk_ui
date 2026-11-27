import { describe, expect, it } from 'vitest'
import { createLoopFake } from './loop-fake'

describe('LoopPort fake', () => {
  it('starts and stops once each, like FrameLoop, and counts real transitions only', () => {
    const loop = createLoopFake()
    expect(loop.isRunning()).toBe(false)
    loop.stop()
    loop.start()
    loop.start()
    expect(loop.isRunning()).toBe(true)
    loop.stop()
    expect([loop.isRunning(), loop.startCount, loop.stopCount]).toStrictEqual([false, 1, 1])
  })
})
