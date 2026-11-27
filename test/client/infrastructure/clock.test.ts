import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { createGameClock } from '../../../src/client/infrastructure/clock'

const FIRST_READING = 1200
const SECOND_READING = 1250
const GAME_TIMER_VALUES = [FIRST_READING, SECOND_READING]

let natives: NativeRecorder

afterEach(() => natives.restore())

describe('game clock', () => {
  it('reads GetGameTimer on every call, never Date.now', () => {
    const readings = [...GAME_TIMER_VALUES]
    natives = installNatives({ GetGameTimer: () => readings.shift() })
    const clock = createGameClock()
    expect([clock.now(), clock.now()]).toEqual(GAME_TIMER_VALUES)
    expect(natives.callsOf('GetGameTimer')).toHaveLength(GAME_TIMER_VALUES.length)
  })
})
