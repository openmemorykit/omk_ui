import type { Scheduler } from '../application/ports'
import type { TimerKind } from '../domain/page-commands'

export interface TimerApi {
  setTimeout(callback: () => void, delayMs: number): number
  clearTimeout(handle: number): void
}

export const MAX_TIMER_DELAY_MS = 2147483647

function clampDelay(delayMs: number): number {
  if (Number.isNaN(delayMs)) return 0
  return Math.min(MAX_TIMER_DELAY_MS, Math.max(0, delayMs))
}

export function createTimeoutScheduler(timers: TimerApi): Scheduler {
  const handles = new Map<TimerKind, number>()

  function cancel(timer: TimerKind): void {
    const handle = handles.get(timer)
    if (handle === undefined) return
    handles.delete(timer)
    try {
      timers.clearTimeout(handle)
    } catch {
      return
    }
  }

  function schedule(timer: TimerKind, delayMs: number, fire: () => void): void {
    cancel(timer)
    try {
      const handle = timers.setTimeout(() => {
        handles.delete(timer)
        try {
          fire()
        } catch {
          return
        }
      }, clampDelay(delayMs))
      handles.set(timer, handle)
    } catch {
      return
    }
  }

  return { schedule, cancel }
}
