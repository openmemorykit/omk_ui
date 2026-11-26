import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { JSON_MAX_DEPTH, JsonObjectSchema, JsonValueSchema } from '../../../src/shared/report/json-value'

const BUDGET_MS = 300
const WIDE_BUDGET_MS = 1000
const EVERY_OTHER = 2
const WIDTH = 4
const WIDE_LENGTH = 100_000
const LIMIT_ISSUES = 1

function leafAtLevel(levels: number, leaf: unknown, wrap: (inner: unknown) => unknown): unknown {
  let value = leaf
  for (let level = 0; level < levels; level += 1) value = wrap(value)
  return value
}

function fullTree(levels: number, leaf: () => unknown): unknown {
  if (levels === 0) return leaf()
  return Array.from({ length: WIDTH }, () => fullTree(levels - 1, leaf))
}

function measure(action: () => void): number {
  action()
  const start = Date.now()
  action()
  return Date.now() - start
}

describe('worst cases inside the depth limit', () => {
  it('refuses NaN at the last level read, in arrays', () => {
    const input = leafAtLevel(JSON_MAX_DEPTH, Number.NaN, (inner) => [inner])
    let success = true
    expect(measure(() => { success = v.safeParse(JsonValueSchema, input).success })).toBeLessThan(BUDGET_MS)
    expect(success).toBe(false)
  })

  it('refuses NaN at the last level read, in objects', () => {
    const input = leafAtLevel(JSON_MAX_DEPTH, Number.NaN, (inner) => ({ inner }))
    let success = true
    expect(measure(() => { success = v.safeParse(JsonObjectSchema, input).success })).toBeLessThan(BUDGET_MS)
    expect(success).toBe(false)
  })

  it('refuses a wide tree of 4 per level over 8 levels with one NaN leaf', () => {
    let seen = 0
    const input = fullTree(JSON_MAX_DEPTH, () => {
      seen += 1
      return seen === 1 ? Number.NaN : seen
    })
    let success = true
    expect(measure(() => { success = v.safeParse(JsonValueSchema, input).success })).toBeLessThan(BUDGET_MS)
    expect(success).toBe(false)
  })

  it('accepts the same wide tree when every leaf is valid', () => {
    const input = fullTree(JSON_MAX_DEPTH, () => 1)
    let success = false
    expect(measure(() => { success = v.safeParse(JsonValueSchema, input).success })).toBeLessThan(BUDGET_MS)
    expect(success).toBe(true)
  })

  it('refuses a wide mixed list of valid and NaN leaves', () => {
    const input = Array.from({ length: WIDE_LENGTH }, (_, index) => (index % EVERY_OTHER === 0 ? Number.NaN : { index }))
    expect(measure(() => { v.safeParse(JsonValueSchema, input) })).toBeLessThan(WIDE_BUDGET_MS)
    expect(v.safeParse(JsonValueSchema, input).success).toBe(false)
  })

  it('bounds the issues with abortEarly', () => {
    const input = Array.from({ length: WIDE_LENGTH }, () => Number.NaN)
    expect(v.safeParse(JsonValueSchema, input, { abortEarly: true }).issues).toHaveLength(LIMIT_ISSUES)
  })
})
