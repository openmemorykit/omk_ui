import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { JSON_MAX_DEPTH, JsonObjectSchema, type JsonObject } from '../../../src/shared/report/json-value'
import { appendTrace, EMPTY_TRACE, TRACE_LINE_MAX_DEPTH } from '../../../src/client/domain/trace-buffer'
import { freeFormTraceLine } from './free-form-trace-line'

const TIMESTAMP = 1
const EXTRA_LEVELS = 2

function nested(levels: number): JsonObject {
  let data: JsonObject = {}
  for (let level = 0; level < levels; level += 1) data = { child: data }
  return data
}

describe('trace buffer: depth', () => {
  it('shares the depth bound of the server', () => {
    expect(TRACE_LINE_MAX_DEPTH).toBe(JSON_MAX_DEPTH)
  })

  it('keeps a line exactly when the server accepts its data, around the bound', () => {
    for (let levels = 0; levels <= JSON_MAX_DEPTH + EXTRA_LEVELS; levels += 1) {
      const data = nested(levels)
      const kept = appendTrace(EMPTY_TRACE, freeFormTraceLine(TIMESTAMP, data)) !== EMPTY_TRACE
      expect(kept, `levels ${levels}`).toBe(v.safeParse(JsonObjectSchema, data).success)
    }
  })
})
