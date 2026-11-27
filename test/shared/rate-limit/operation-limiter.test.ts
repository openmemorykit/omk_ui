import { createManualClock } from '@openmemorykit/core/testing'
import { describe, expect, it } from 'vitest'
import { createOperationLimiter, OPERATION_KEYS_MAX, ONE_LINE_PER_OPERATION_INTERVAL_MS } from '../../../src/shared/rate-limit/operation-limiter'

const OPERATION = 'controls.readPad'
const FLOOD_FACTOR = 10

describe('createOperationLimiter', () => {
  it('lets the first line of an operation through', () => {
    expect(createOperationLimiter(createManualClock(0))(OPERATION)).toBe(true)
  })

  it('holds back an operation for one minute, to the millisecond', () => {
    const clock = createManualClock(0)
    const allows = createOperationLimiter(clock)
    allows(OPERATION)
    clock.advance(ONE_LINE_PER_OPERATION_INTERVAL_MS - 1)
    expect(allows(OPERATION)).toBe(false)
    clock.advance(1)
    expect(allows(OPERATION)).toBe(true)
  })

  it('counts each operation on its own', () => {
    const allows = createOperationLimiter(createManualClock(0))
    allows(OPERATION)
    expect(allows('game.resolution')).toBe(true)
    expect(allows(OPERATION)).toBe(false)
  })

  it('does not extend the wait when a held-back line comes back', () => {
    const clock = createManualClock(0)
    const allows = createOperationLimiter(clock)
    allows(OPERATION)
    clock.advance(ONE_LINE_PER_OPERATION_INTERVAL_MS - 1)
    allows(OPERATION)
    clock.advance(1)
    expect(allows(OPERATION)).toBe(true)
  })

  it('remembers at most OPERATION_KEYS_MAX operations and forgets the oldest first', () => {
    const allows = createOperationLimiter(createManualClock(0))
    for (let index = 0; index <= OPERATION_KEYS_MAX; index += 1) allows(`operation ${index}`)
    expect(allows('operation 1')).toBe(false)
    expect(allows('operation 0')).toBe(true)
  })

  it('stays bounded under a flood of distinct names', () => {
    const allows = createOperationLimiter(createManualClock(0))
    for (let index = 0; index < OPERATION_KEYS_MAX * FLOOD_FACTOR; index += 1) expect(allows(`operation ${index}`)).toBe(true)
    expect(allows(`operation ${OPERATION_KEYS_MAX * FLOOD_FACTOR - 1}`)).toBe(false)
  })
})
