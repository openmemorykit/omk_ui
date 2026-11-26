import { describe, expect, it } from 'vitest'
import { TimerKind } from '../../../src/page/domain/page-commands'
import { createTimeoutScheduler, MAX_TIMER_DELAY_MS, type TimerApi } from '../../../src/page/infrastructure/timeout-scheduler'

const SHORT = 90
const LONG = 320
const HOLD = 600
const TOAST = 100
const TICK = 10
const TWICE = 2
const THRICE = 3
const BEFORE = -5

interface Pending { readonly callback: () => void; readonly delayMs: number }

function fakeTimers(): { readonly api: TimerApi; readonly pending: Map<number, Pending>; readonly cleared: number[] } {
  const pending = new Map<number, Pending>()
  const cleared: number[] = []
  let next = 1
  const api: TimerApi = {
    setTimeout: (callback, delayMs) => {
      const handle = next
      next += 1
      pending.set(handle, { callback, delayMs })
      return handle
    },
    clearTimeout: (handle) => {
      cleared.push(handle)
      pending.delete(handle)
    },
  }
  return { api, pending, cleared }
}

function expire(timers: ReturnType<typeof fakeTimers>): void {
  for (const [handle, entry] of [...timers.pending]) {
    timers.pending.delete(handle)
    entry.callback()
  }
}

describe('timeout scheduler', () => {
  it('replaces the timer of the same kind: one callback after two schedules', () => {
    const timers = fakeTimers()
    const scheduler = createTimeoutScheduler(timers.api)
    const fired: string[] = []
    scheduler.schedule(TimerKind.Repeat, SHORT, () => void fired.push('first'))
    scheduler.schedule(TimerKind.Repeat, LONG, () => void fired.push('second'))
    expect(timers.pending.size).toBe(1)
    expect([...timers.pending.values()][0]?.delayMs).toBe(LONG)
    expire(timers)
    expect(fired).toEqual(['second'])
  })

  it('keeps one independent timer per kind', () => {
    const timers = fakeTimers()
    const scheduler = createTimeoutScheduler(timers.api)
    const fired: TimerKind[] = []
    scheduler.schedule(TimerKind.Repeat, SHORT, () => void fired.push(TimerKind.Repeat))
    scheduler.schedule(TimerKind.BackHold, HOLD, () => void fired.push(TimerKind.BackHold))
    expect(timers.pending.size).toBe(TWICE)
    expire(timers)
    expect(fired).toEqual([TimerKind.Repeat, TimerKind.BackHold])
  })

  it('cancels a timer, and cancelling an idle kind does nothing', () => {
    const timers = fakeTimers()
    const scheduler = createTimeoutScheduler(timers.api)
    const fired: string[] = []
    scheduler.cancel(TimerKind.ToastExpiry)
    scheduler.schedule(TimerKind.ToastExpiry, TOAST, () => void fired.push('toast'))
    scheduler.cancel(TimerKind.ToastExpiry)
    expect(timers.pending.size).toBe(0)
    expect(timers.cleared).toHaveLength(1)
    expire(timers)
    expect(fired).toEqual([])
  })

  it('leaves no timer at rest after expiry, and can schedule again', () => {
    const timers = fakeTimers()
    const scheduler = createTimeoutScheduler(timers.api)
    let count = 0
    scheduler.schedule(TimerKind.WaitingTimeout, TICK, () => void (count += 1))
    expire(timers)
    expect(timers.pending.size).toBe(0)
    scheduler.cancel(TimerKind.WaitingTimeout)
    expect(timers.cleared).toEqual([])
    scheduler.schedule(TimerKind.WaitingTimeout, TICK, () => void (count += 1))
    expire(timers)
    expect(count).toBe(TWICE)
  })

  it('lets a callback reschedule its own kind', () => {
    const timers = fakeTimers()
    const scheduler = createTimeoutScheduler(timers.api)
    let count = 0
    const again = (): void => {
      count += 1
      if (count < THRICE) scheduler.schedule(TimerKind.Repeat, SHORT, again)
    }
    scheduler.schedule(TimerKind.Repeat, SHORT, again)
    expire(timers)
    expire(timers)
    expire(timers)
    expect(count).toBe(THRICE)
    expect(timers.pending.size).toBe(0)
  })

  it('swallows an exception thrown by the callback', () => {
    const timers = fakeTimers()
    const scheduler = createTimeoutScheduler(timers.api)
    scheduler.schedule(TimerKind.LinkPending, TICK, () => {
      throw new Error('boom')
    })
    expect(() => expire(timers)).not.toThrow()
  })

  it('swallows a failing timer api', () => {
    const scheduler = createTimeoutScheduler({
      setTimeout: () => {
        throw new Error('no timers')
      },
      clearTimeout: () => {
        throw new Error('no timers')
      },
    })
    expect(() => scheduler.schedule(TimerKind.Repeat, TICK, () => undefined)).not.toThrow()
    expect(() => scheduler.cancel(TimerKind.Repeat)).not.toThrow()
  })

  it('clamps a negative, non-finite or huge delay', () => {
    const timers = fakeTimers()
    const scheduler = createTimeoutScheduler(timers.api)
    const delays: number[] = []
    for (const delay of [BEFORE, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER]) {
      scheduler.schedule(TimerKind.Repeat, delay, () => undefined)
      delays.push([...timers.pending.values()][0]?.delayMs ?? -1)
    }
    expect(delays[0]).toBe(0)
    expect(delays[1]).toBe(0)
    for (const delay of delays.slice(TWICE)) expect(delay).toBeLessThanOrEqual(MAX_TIMER_DELAY_MS)
  })
})
