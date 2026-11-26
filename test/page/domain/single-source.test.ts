import { describe, expect, it } from 'vitest'
import * as guards from '../../../src/page/domain/guards'
import * as toasts from '../../../src/page/domain/toasts'
import { isCommandSeq } from '../../../src/protocol/stack'
import { readSource } from '../theme/read-source'

const UI_STATE_SOURCE = 'src/page/domain/ui-state.ts'
const UNSAFE_INTEGER = Number.MAX_SAFE_INTEGER + 1
const FRACTION = 1.5

describe('toast limits', () => {
  it('are read from the contract, not redefined', () => {
    expect(Object.keys(toasts)).not.toContain('MAX_VISIBLE_TOASTS')
    expect(Object.keys(toasts)).not.toContain('MAX_WAITING_TOASTS')
  })
})

describe('isCommandSeq', () => {
  it('lives in the protocol, not in the page guards', () => {
    expect(Object.keys(guards)).not.toContain('isCommandSeq')
  })

  it('accepts safe non-negative integers only', () => {
    expect([0, 1, Number.MAX_SAFE_INTEGER].map(isCommandSeq)).toEqual([true, true, true])
    expect([-1, FRACTION, NaN, Infinity, UNSAFE_INTEGER, '1', null, undefined].map(isCommandSeq)).toEqual([false, false, false, false, false, false, false, false])
  })
})

describe('page domain modules', () => {
  it('take their theme defaults from the module without valibot', () => {
    const source = readSource(UI_STATE_SOURCE)
    expect(source).toContain('shared/config/theme-defaults')
    const schemaImports = source.split('\n').filter((line) => line.includes('config-schema'))
    expect(schemaImports.filter((line) => !line.startsWith('import type'))).toEqual([])
  })
})
