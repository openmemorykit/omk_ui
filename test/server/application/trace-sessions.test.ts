import { describe, expect, it } from 'vitest'
import { TraceSessions } from '../../../src/server/application/trace-sessions'

const PLAYER = 2
const OTHER_PLAYER = 5
const LATE_PLAYER = 9

describe('trace sessions', () => {
  it('starts with nobody traced', () => {
    const traces = new TraceSessions()
    expect([traces.isActive(PLAYER), traces.isEveryoneTraced]).toStrictEqual([false, false])
  })

  it('traces one player only', () => {
    const traces = new TraceSessions()
    traces.activate(PLAYER)
    expect([traces.isActive(PLAYER), traces.isActive(OTHER_PLAYER)]).toStrictEqual([true, false])
    traces.deactivate(PLAYER)
    expect(traces.isActive(PLAYER)).toBe(false)
  })

  it('traces everyone, including a player who joins later', () => {
    const traces = new TraceSessions()
    traces.activateAll()
    expect([traces.isActive(PLAYER), traces.isActive(LATE_PLAYER), traces.isEveryoneTraced]).toStrictEqual([true, true, true])
  })

  it('lets one player be cut while everyone else stays traced, then traced again', () => {
    const traces = new TraceSessions()
    traces.activateAll()
    traces.deactivate(PLAYER)
    expect([traces.isActive(PLAYER), traces.isActive(OTHER_PLAYER)]).toStrictEqual([false, true])
    traces.activate(PLAYER)
    expect(traces.isActive(PLAYER)).toBe(true)
  })

  it('cuts everybody at once, individual choices included', () => {
    const traces = new TraceSessions()
    traces.activate(PLAYER)
    traces.activateAll()
    traces.deactivate(OTHER_PLAYER)
    traces.deactivateAll()
    expect([traces.isActive(PLAYER), traces.isActive(OTHER_PLAYER), traces.isEveryoneTraced]).toStrictEqual([false, false, false])
    expect(traces.trackedCount).toBe(0)
  })

  it('forgets a player who left, whichever way he was traced', () => {
    const traces = new TraceSessions()
    traces.activate(PLAYER)
    traces.forget(PLAYER)
    expect([traces.isActive(PLAYER), traces.trackedCount]).toStrictEqual([false, 0])
    traces.activateAll()
    traces.deactivate(OTHER_PLAYER)
    traces.forget(OTHER_PLAYER)
    expect([traces.isActive(OTHER_PLAYER), traces.trackedCount]).toStrictEqual([true, 0])
  })
})
