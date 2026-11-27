import { describe, expect, it } from 'vitest'
import { SNAPSHOT_TIMEOUT_MS, SnapshotRequests } from '../../../src/server/application/snapshot-requests'

const PLAYER = 2
const OTHER_PLAYER = 5
const START = 10_000
const THREE_SECONDS = 3000
const TWO_SECONDS = 2000
const present = (): readonly string[] => []
const reply = (): void => undefined

describe('snapshot requests', () => {
  it('waits 3 seconds for the answer', () => {
    expect(SNAPSHOT_TIMEOUT_MS).toBe(THREE_SECONDS)
  })

  it('accepts a snapshot only from a player who was asked, and only once', () => {
    const requests = new SnapshotRequests()
    expect(requests.isPending(PLAYER, START)).toBe(false)
    requests.open(PLAYER, START, present, reply)
    expect([requests.isPending(PLAYER, START), requests.isPending(OTHER_PLAYER, START)]).toStrictEqual([true, false])
    expect(requests.take(PLAYER)).not.toBeNull()
    expect([requests.isPending(PLAYER, START), requests.take(PLAYER)]).toStrictEqual([false, null])
  })

  it('stops accepting after 3 seconds, not before', () => {
    const requests = new SnapshotRequests()
    requests.open(PLAYER, START, present, reply)
    expect(requests.isPending(PLAYER, START + SNAPSHOT_TIMEOUT_MS)).toBe(true)
    expect(requests.isPending(PLAYER, START + SNAPSHOT_TIMEOUT_MS + 1)).toBe(false)
  })

  it('gives a new request identifier each time', () => {
    const requests = new SnapshotRequests()
    const first = requests.open(PLAYER, START, present, reply)
    const second = requests.open(OTHER_PLAYER, START, present, reply)
    expect(second).toBe(first + 1)
  })

  it('replaces the request of a player who is asked again', () => {
    const requests = new SnapshotRequests()
    requests.open(PLAYER, START, present, reply)
    const second = requests.open(PLAYER, START + 1, present, reply)
    expect(requests.take(PLAYER)?.requestId).toBe(second)
    expect(requests.trackedCount).toBe(0)
  })

  it('hands out the requests that timed out, once, and keeps the others', () => {
    const requests = new SnapshotRequests()
    requests.open(PLAYER, START, present, reply)
    requests.open(OTHER_PLAYER, START + TWO_SECONDS, present, reply)
    expect(requests.expire(START + SNAPSHOT_TIMEOUT_MS).map((entry) => entry.player)).toStrictEqual([])
    expect(requests.expire(START + SNAPSHOT_TIMEOUT_MS + 1).map((entry) => entry.player)).toStrictEqual([PLAYER])
    expect(requests.expire(START + SNAPSHOT_TIMEOUT_MS + 1)).toStrictEqual([])
    expect(requests.trackedCount).toBe(1)
  })

  it('does not time out on a clock that is not a number', () => {
    const requests = new SnapshotRequests()
    requests.open(PLAYER, START, present, reply)
    expect(requests.expire(Number.NaN)).toStrictEqual([])
    expect(requests.isPending(PLAYER, Number.NaN)).toBe(false)
  })
})
