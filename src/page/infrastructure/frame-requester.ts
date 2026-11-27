import type { FrameRequester } from '../application/ports'

export type RequestFrame = (callback: FrameRequestCallback) => number

export function createFrameRequester(raf: RequestFrame): FrameRequester {
  let pending: (() => void) | null = null

  function run(): void {
    const callback = pending
    pending = null
    try {
      callback?.()
    } catch {
      return
    }
  }

  return {
    request(callback) {
      const waiting = pending !== null
      pending = callback
      if (waiting) return
      try {
        raf(run)
      } catch {
        pending = null
      }
    },
  }
}
