import { describe, expect, it } from 'vitest'
import { isPumpNeeded } from '../../../src/client/application/pump-demand'
import { INITIAL_CLIENT_SESSION } from '../../../src/client/application/session-state'
import { PUMPING_SESSIONS } from './pumping-sessions'

describe('isPumpNeeded', () => {
  it('is false at rest: idle, no gesture, no guard, no prompt', () => {
    expect(isPumpNeeded(INITIAL_CLIENT_SESSION)).toBe(false)
  })

  it.each(PUMPING_SESSIONS)('is true when %s', (_reason, session) => {
    expect(isPumpNeeded(session)).toBe(true)
  })

  it('stays false while paused at rest', () => {
    expect(isPumpNeeded({ ...INITIAL_CLIENT_SESSION, paused: true })).toBe(false)
  })
})
