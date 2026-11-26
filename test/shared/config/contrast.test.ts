import { describe, expect, it } from 'vitest'
import { contrastRatio, relativeLuminance } from '../../../src/shared/config/contrast'

const MAX_RATIO = 21
const PRECISION = 5

const MID_GRAY_LUMINANCE = 0.2159
const RED_LUMINANCE = 0.2126
const GRAY_777_RATIO = 4.48
const GRAY_767676_RATIO = 4.54
const RATIO_PRECISION = 2
const LUMINANCE_PRECISION = 4

describe('contrast', () => {
  it('applies the sRGB gamma to mid tones', () => {
    expect(relativeLuminance('#808080')).toBeCloseTo(MID_GRAY_LUMINANCE, LUMINANCE_PRECISION)
    expect(relativeLuminance('#FF0000')).toBeCloseTo(RED_LUMINANCE, LUMINANCE_PRECISION)
  })

  it('matches the WCAG reference ratios on white', () => {
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(GRAY_777_RATIO, RATIO_PRECISION)
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(GRAY_767676_RATIO, RATIO_PRECISION)
  })

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
