import type { LoopPort } from '../../../src/client/application/ports'

export interface LoopFake extends LoopPort {
  readonly startCount: number
  readonly stopCount: number
}

export function createLoopFake(): LoopFake {
  let running = false
  let startCount = 0
  let stopCount = 0
  return {
    start() {
      if (running) return
      running = true
      startCount += 1
    },
    stop() {
      if (!running) return
      running = false
      stopCount += 1
    },
    isRunning: () => running,
    get startCount() {
      return startCount
    },
    get stopCount() {
      return stopCount
    },
  }
}
