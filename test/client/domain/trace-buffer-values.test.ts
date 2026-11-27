import { describe, expect, it } from 'vitest'
import type { JsonObject } from '../../../src/shared/report/json-value'
import { appendTrace, EMPTY_TRACE, TRACE_LINE_MAX_BYTES, type TraceLine } from '../../../src/client/domain/trace-buffer'
import { freeFormTraceLine } from './free-form-trace-line'

const TIMESTAMP = 1
const TWO_BYTE_TEXT = 'é'
const THREE_BYTE_TEXT = '€'
const FOUR_BYTE_TEXT = '😀'
const LONE_HIGH_SURROGATE = '\uD83D'
const LONE_HIGH_THEN_ASCII = '\uD83Dx'
const BYTES_PER_TWO_BYTE_CHARACTER = 2
const BYTES_PER_THREE_BYTE_CHARACTER = 3
const BYTES_PER_FOUR_BYTE_CHARACTER = 4
const ESCAPED_SURROGATE_BYTES = 6

function lineWith(data: JsonObject): TraceLine {
  return freeFormTraceLine(TIMESTAMP, data)
}

function sizeOfText(text: string): number {
  const base = appendTrace(EMPTY_TRACE, lineWith({ text: '' })).totalBytes
  return appendTrace(EMPTY_TRACE, lineWith({ text })).totalBytes - base
}

describe('trace buffer: value kinds', () => {
  it('keeps booleans and nulls', () => {
    const buffer = appendTrace(EMPTY_TRACE, lineWith({ active: true, idle: false, nothing: null }))
    expect(buffer.lines[0]?.data).toEqual({ active: true, idle: false, nothing: null })
  })

  it('refuses a line carrying a number that is not finite', () => {
    expect(appendTrace(EMPTY_TRACE, lineWith({ speed: Number.NaN }))).toBe(EMPTY_TRACE)
    expect(appendTrace(EMPTY_TRACE, lineWith({ speed: Number.POSITIVE_INFINITY }))).toBe(EMPTY_TRACE)
  })
})

describe('trace buffer: byte size by character width', () => {
  it('counts one, two, three and four bytes per character', () => {
    expect(sizeOfText('a')).toBe(1)
    expect(sizeOfText(TWO_BYTE_TEXT)).toBe(BYTES_PER_TWO_BYTE_CHARACTER)
    expect(sizeOfText(THREE_BYTE_TEXT)).toBe(BYTES_PER_THREE_BYTE_CHARACTER)
    expect(sizeOfText(FOUR_BYTE_TEXT)).toBe(BYTES_PER_FOUR_BYTE_CHARACTER)
  })

  it('counts a lone surrogate as its six character JSON escape', () => {
    expect(sizeOfText(LONE_HIGH_SURROGATE)).toBe(ESCAPED_SURROGATE_BYTES)
    expect(sizeOfText(LONE_HIGH_THEN_ASCII)).toBe(ESCAPED_SURROGATE_BYTES + 1)
  })

  it('refuses a line made of wide characters once it passes the line limit', () => {
    const wide = THREE_BYTE_TEXT.repeat(Math.ceil(TRACE_LINE_MAX_BYTES / BYTES_PER_THREE_BYTE_CHARACTER))
    expect(appendTrace(EMPTY_TRACE, lineWith({ text: wide }))).toBe(EMPTY_TRACE)
  })
})
