const RESULT = 5

import { describe, expect, it } from 'vitest'
import { guardedCall } from '../../src/shared/guarded-call'

describe('guardedCall', () => {
  it('returns what the call returns', () => {
    expect(guardedCall(() => undefined, 'op', () => RESULT, 0)).toBe(RESULT)
  })

  it('returns the fallback and reports the operation when the call throws', () => {
    const failures: unknown[][] = []
    const failure = new Error('boom')
    const result = guardedCall((operation, cause) => failures.push([operation, cause]), 'SendNuiMessage', () => { throw failure }, 'fallback')
    expect(result).toBe('fallback')
    expect(failures).toEqual([['SendNuiMessage', failure]])
  })

  it('never throws when the failure handler throws too', () => {
    expect(guardedCall(() => { throw new Error('handler') }, 'op', () => { throw new Error('call') }, 1)).toBe(1)
  })
})
