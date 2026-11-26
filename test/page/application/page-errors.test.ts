import { describe, expect, it } from 'vitest'
import { FromPage, PAGE_ERROR_STACK_MAX_BYTES } from '../../../src/protocol/from-page'
import { PAGE_ERROR_MESSAGE_MAX_UNITS, pageErrorMessage } from '../../../src/page/application/page-errors'

const KILOBYTE = 1024
const TEN = 10
const TEN_KB = TEN * KILOBYTE
const EMOJI = '\u{1F600}'
const EMOJI_BYTES = 4
const ACCENT = 'é'
const ACCENT_BYTES = 2
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

function bytes(text: string): number {
  return new TextEncoder().encode(text).length
}

function stackOf(message: ReturnType<typeof pageErrorMessage>): string {
  if (message.type !== FromPage.PageError) throw new Error('not a page error')
  return message.stack
}

describe('pageErrorMessage', () => {
  it('builds a pageError message and keeps short text as is', () => {
    expect(pageErrorMessage('boom', 'at x')).toEqual({ type: FromPage.PageError, message: 'boom', stack: 'at x' })
  })

  it('cuts the message at 256 units', () => {
    const message = pageErrorMessage('a'.repeat(TEN_KB), '')
    expect(message.type === FromPage.PageError && message.message.length).toBe(PAGE_ERROR_MESSAGE_MAX_UNITS)
  })

  it('keeps a message of exactly 256 units whole', () => {
    const text = 'b'.repeat(PAGE_ERROR_MESSAGE_MAX_UNITS)
    expect(pageErrorMessage(text, '')).toMatchObject({ message: text })
  })

  it('does not split a surrogate pair at the message limit', () => {
    const text = 'a'.repeat(PAGE_ERROR_MESSAGE_MAX_UNITS - 1) + EMOJI
    const message = pageErrorMessage(text, '')
    expect(message).toMatchObject({ message: 'a'.repeat(PAGE_ERROR_MESSAGE_MAX_UNITS - 1) })
  })

  it('cuts a 10 KB stack to at most the byte limit', () => {
    const stack = stackOf(pageErrorMessage('', 'x'.repeat(TEN_KB)))
    expect(bytes(stack)).toBe(PAGE_ERROR_STACK_MAX_BYTES)
  })

  it('counts bytes, not units, for multi-byte text', () => {
    const stack = stackOf(pageErrorMessage('', ACCENT.repeat(TEN_KB)))
    expect(bytes(stack)).toBe(PAGE_ERROR_STACK_MAX_BYTES)
    expect(stack.length).toBe(PAGE_ERROR_STACK_MAX_BYTES / ACCENT_BYTES)
  })

  it('does not split an emoji at the byte limit', () => {
    const prefix = 'x'.repeat(PAGE_ERROR_STACK_MAX_BYTES - EMOJI_BYTES + 1)
    const stack = stackOf(pageErrorMessage('', prefix + EMOJI))
    expect(stack).toBe(prefix)
    expect(bytes(stack)).toBeLessThanOrEqual(PAGE_ERROR_STACK_MAX_BYTES)
  })

  it('keeps an emoji that ends exactly on the byte limit', () => {
    const prefix = 'x'.repeat(PAGE_ERROR_STACK_MAX_BYTES - EMOJI_BYTES)
    const stack = stackOf(pageErrorMessage('', prefix + EMOJI + 'tail'))
    expect(stack).toBe(prefix + EMOJI)
    expect(bytes(stack)).toBe(PAGE_ERROR_STACK_MAX_BYTES)
  })

  it('never produces a lone surrogate over a stack of emoji', () => {
    const stack = stackOf(pageErrorMessage('', EMOJI.repeat(TEN_KB)))
    expect(LONE_SURROGATE.test(stack)).toBe(false)
    expect(bytes(stack)).toBe(PAGE_ERROR_STACK_MAX_BYTES)
  })
})
