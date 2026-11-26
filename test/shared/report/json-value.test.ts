import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { JSON_MAX_DEPTH, JsonObjectSchema, JsonValueSchema } from '../../../src/shared/report/json-value'

const WORST_CASE_BUDGET_MS = 50
const MILLION = 1_000_000
const JUST_OVER = 18
const FAR_OVER = 30
const THOUSANDS = 10_000
const HUNDRED_THOUSANDS = 100_000
const DEPTHS = [JUST_OVER, FAR_OVER, THOUSANDS, HUNDRED_THOUSANDS]
const EXPECTED_DEPTH = 8
const VIEW_LENGTH = 5_000_000
const HUGE_BIGINT = BigInt(MILLION)
const NESTED_LIST_LENGTH = 3

function nestArrays(levels: number, innermost: unknown): unknown {
  let value = innermost
  for (let level = 0; level < levels; level += 1) value = [value]
  return value
}

function nestObjects(levels: number, innermost: unknown): unknown {
  let value = innermost
  for (let level = 0; level < levels; level += 1) value = { next: value }
  return value
}

function timed(action: () => void): number {
  const start = Date.now()
  action()
  return Date.now() - start
}

describe('JSON value schema', () => {
  it('accepts scalars, mixed arrays and objects', () => {
    const value = { text: 'a', count: 1.5, flag: false, nothing: null, list: [1, 'two', { three: [NESTED_LIST_LENGTH] }], nested: { deep: [] } }
    expect(v.parse(JsonValueSchema, value)).toEqual(value)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('refuses the non-finite number %s', (number) => {
    expect(v.safeParse(JsonValueSchema, number).success).toBe(false)
    expect(v.safeParse(JsonValueSchema, [number]).success).toBe(false)
    expect(v.safeParse(JsonValueSchema, { value: number }).success).toBe(false)
  })

  it.each([undefined, () => 1, HUGE_BIGINT, Symbol('x')])('refuses a non-JSON scalar', (input) => {
    expect(v.safeParse(JsonValueSchema, input).success).toBe(false)
  })

  it('accepts 8 levels and refuses 9, in arrays and in objects', () => {
    expect(JSON_MAX_DEPTH).toBe(EXPECTED_DEPTH)
    expect(v.safeParse(JsonValueSchema, nestArrays(JSON_MAX_DEPTH, 1)).success).toBe(true)
    expect(v.safeParse(JsonValueSchema, nestArrays(JSON_MAX_DEPTH + 1, 1)).success).toBe(false)
    expect(v.safeParse(JsonValueSchema, nestObjects(JSON_MAX_DEPTH, 1)).success).toBe(true)
    expect(v.safeParse(JsonValueSchema, nestObjects(JSON_MAX_DEPTH + 1, 1)).success).toBe(false)
  })

  it('counts the object itself as the first level for the object schema', () => {
    expect(v.safeParse(JsonObjectSchema, nestObjects(JSON_MAX_DEPTH, 1)).success).toBe(true)
    expect(v.safeParse(JsonObjectSchema, nestObjects(JSON_MAX_DEPTH + 1, 1)).success).toBe(false)
  })

  it('refuses a typed array or a view, even huge, quickly', () => {
    const view = new Uint8Array(VIEW_LENGTH)
    const elapsed = timed(() => {
      expect(v.safeParse(JsonValueSchema, view).success).toBe(false)
      expect(v.safeParse(JsonValueSchema, [view]).success).toBe(false)
      expect(v.safeParse(JsonValueSchema, { view }).success).toBe(false)
      expect(v.safeParse(JsonObjectSchema, view).success).toBe(false)
      expect(v.safeParse(JsonValueSchema, new DataView(new ArrayBuffer(MILLION))).success).toBe(false)
    })
    expect(elapsed).toBeLessThan(WORST_CASE_BUDGET_MS)
  })

  it('does not accept a list where an object schema expects an object, except the empty list', () => {
    expect(v.safeParse(JsonObjectSchema, [1]).success).toBe(false)
    expect(v.safeParse(JsonObjectSchema, 'text').success).toBe(false)
    expect(v.safeParse(JsonObjectSchema, null).success).toBe(false)
  })

  it('turns an empty list into an empty object', () => {
    expect(v.parse(JsonObjectSchema, [])).toEqual({})
    expect(Array.isArray(v.parse(JsonObjectSchema, []))).toBe(false)
  })

  it('keeps an empty list as a list inside a value', () => {
    expect(v.parse(JsonValueSchema, { items: [] })).toEqual({ items: [] })
  })

  describe.each(DEPTHS)('worst case at %i nested levels', (levels) => {
    it('refuses arrays around NaN without throwing, quickly', () => {
      const input = nestArrays(levels, Number.NaN)
      v.safeParse(JsonValueSchema, nestArrays(levels, Number.NaN))
      let success = true
      const elapsed = timed(() => {
        success = v.safeParse(JsonValueSchema, input).success
      })
      expect(success).toBe(false)
      expect(elapsed).toBeLessThan(WORST_CASE_BUDGET_MS)
    })

    it('refuses objects around NaN without throwing, quickly', () => {
      const input = nestObjects(levels, Number.NaN)
      let success = true
      const elapsed = timed(() => {
        success = v.safeParse(JsonObjectSchema, input).success
      })
      expect(success).toBe(false)
      expect(elapsed).toBeLessThan(WORST_CASE_BUDGET_MS)
    })
  })
})
