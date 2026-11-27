import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRandomSource } from '../../../src/client/infrastructure/random'

const DRAWN = 0.25

afterEach(() => vi.restoreAllMocks())

describe('random source', () => {
  it('draws from Math.random', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(DRAWN)
    expect(createRandomSource().next()).toBe(DRAWN)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
