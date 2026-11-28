import { describe, expect, it } from 'vitest'
import { measureCallBytes } from '../../../src/client/application/call-size'

const ROOM = 1_000_000
const SMALL_ROOM = 10
const SLACK_BYTES = 6
const INTEGER = 42
const FRACTION = -1.5
const DEEP_NUMBER = 3
const TWO_DIGITS = 22
const BIG_INTEGER = BigInt(INTEGER)
const MIXED: readonly unknown[] = [
  'plain',
  'say "hi" \\ back\nline\u0001',
  'é€😀',
  '\ud800',
  INTEGER,
  FRACTION,
  Number.POSITIVE_INFINITY,
  true,
  false,
  null,
  [],
  {},
  { nested: { list: [1, 'two', [DEEP_NUMBER]], flag: true } },
]

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

describe('measureCallBytes', () => {
  it.each(MIXED)('never measures less than the JSON text of %j', (value) => {
    const measured = measureCallBytes(value, ROOM)
    expect(measured).not.toBeNull()
    expect(measured ?? 0).toBeGreaterThanOrEqual(jsonBytes(value))
  })

  it('measures plain values within a few bytes of their JSON text', () => {
    const value = { name: 'abc', list: [1, TWO_DIGITS, true, null], inner: { empty: [] } }
    expect(measureCallBytes(value, ROOM)).toBeLessThanOrEqual(jsonBytes(value) + SLACK_BYTES)
  })

  it('stops one byte past the limit', () => {
    expect(measureCallBytes(['x'.repeat(SMALL_ROOM)], SMALL_ROOM)).toBe(SMALL_ROOM + 1)
    expect(measureCallBytes('x'.repeat(ROOM), SMALL_ROOM)).toBe(SMALL_ROOM + 1)
  })

  it('refuses what JSON cannot hold or what would run code to read', () => {
    const cyclic: unknown[] = []
    cyclic.push(cyclic)
    expect(measureCallBytes(BIG_INTEGER, ROOM)).toBeNull()
    expect(measureCallBytes(cyclic, ROOM)).toBeNull()
    expect(measureCallBytes({ get trap(): number { return 1 } }, ROOM)).toBeNull()
  })

  it('counts a function or an undefined value as nothing, without calling it', () => {
    let called = false
    const withFunction = { callback: () => { called = true }, missing: undefined }
    expect(measureCallBytes(withFunction, ROOM)).toBeGreaterThan(0)
    expect(called).toBe(false)
  })
})
