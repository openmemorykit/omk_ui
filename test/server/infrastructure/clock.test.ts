import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { createServerClock } from '../../../src/server/infrastructure/clock'

const GAME_TIMER = 123_456

let recorder: NativeRecorder | null = null

afterEach(() => {
  recorder?.restore()
  recorder = null
})

describe('server clock', () => {
  it('reads the monotonic GetGameTimer at each call', () => {
    recorder = installNatives({ GetGameTimer: () => GAME_TIMER })
    const clock = createServerClock()
    expect(recorder.callsOf('GetGameTimer')).toStrictEqual([])
    expect(clock.now()).toBe(GAME_TIMER)
    expect(recorder.callsOf('GetGameTimer')).toStrictEqual([[]])
  })
})
