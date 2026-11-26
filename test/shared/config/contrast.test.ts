import { describe, expect, it } from 'vitest'
import { contrastRatio, relativeLuminance } from '../../../src/shared/config/contrast'

const MAX_RATIO = 21
const PRECISION = 5

describe('contrast', () => {
  it('gives black on white a ratio of 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(MAX_RATIO, PRECISION)
  })

  it('gives the same color a ratio of 1', () => {
    expect(contrastRatio('#8F7BFF', '#8F7BFF')).toBe(1)
  })

  it('is symmetric', () => {
    expect(contrastRatio('#14141A', '#8F7BFF')).toBe(contrastRatio('#8F7BFF', '#14141A'))
  })

  it('has luminance 0 for black, 1 for white and 0 for a malformed color', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, PRECISION)
    expect(relativeLuminance('nope')).toBe(0)
  })
})
