import { describe, expect, it } from 'vitest'
import { describeError } from '../../src/shared/describe-error'

describe('describeError', () => {
  it('gives the message of an Error', () => {
    expect(describeError(new Error('boom'))).toBe('boom')
  })

  it('gives the text of anything else', () => {
    expect(describeError('plain')).toBe('plain')
  })

  it('falls back to the type when the value cannot become a text', () => {
    const hostile = { toString: (): string => { throw new Error('no text') } }
    expect(describeError(hostile)).toBe('object')
  })
})
