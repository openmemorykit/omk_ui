const RESULT = 5

import { describe, expect, it } from 'vitest'
import { guardedNativeCall } from '../../../src/client/infrastructure/guarded-native-call'

describe('guardedNativeCall', () => {
  it('returns what the call returns', () => {
    expect(guardedNativeCall(() => undefined, 'op', () => RESULT, 0)).toBe(RESULT)
  })

  it('returns the fallback and reports the operation when the call throws', () => {
    const failures: unknown[][] = []
    const failure = new Error('boom')
    const result = guardedNativeCall((operation, cause) => failures.push([operation, cause]), 'SendNuiMessage', () => { throw failure }, 'fallback')
    expect(result).toBe('fallback')
    expect(failures).toEqual([['SendNuiMessage', failure]])
  })

  it('never throws when the failure handler throws too', () => {
    expect(guardedNativeCall(() => { throw new Error('handler') }, 'op', () => { throw new Error('call') }, 1)).toBe(1)
  })
})
