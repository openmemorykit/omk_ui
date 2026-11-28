import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConsolePort } from '../../../src/client/infrastructure/console'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createConsolePort', () => {
  it('prints a line to the F8 console', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    createConsolePort().print('[omk_ui] hello')
    expect(log).toHaveBeenCalledWith('[omk_ui] hello')
  })

  it('lets nothing escape when the console throws', () => {
    vi.spyOn(console, 'log').mockImplementation(() => { throw new Error('boom') })
    expect(() => createConsolePort().print('x')).not.toThrow()
  })
})
