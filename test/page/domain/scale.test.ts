import { describe, expect, it } from 'vitest'
import { COLUMN_MAX_WIDTH_SHARE, COLUMN_WIDTH, RADIAL_DIAMETER, RADIAL_MAX_HEIGHT_SHARE, SCALE_FLOOR, computeScale } from '../../../src/page/domain/scale'

const PRECISION = 3

interface ScaleCase {
  readonly width: number
  readonly height: number
  readonly serverScale: number
  readonly expected: number
}

const CASES: readonly ScaleCase[] = [
  { width: 1280, height: 720, serverScale: 0.9, expected: 0.8 },
  { width: 1280, height: 720, serverScale: 1, expected: 0.8 },
  { width: 1920, height: 1080, serverScale: 0.9, expected: 0.9 },
  { width: 1920, height: 1080, serverScale: 1, expected: 1 },
  { width: 1920, height: 1080, serverScale: 1.1, expected: 1.1 },
  { width: 1440, height: 1080, serverScale: 1.1, expected: 1.1 },
  { width: 2560, height: 1440, serverScale: 1, expected: 1.333 },
  { width: 3840, height: 2160, serverScale: 1.1, expected: 2.2 },
]

const TALL = { width: 10000, height: 2000, serverScale: 2 }
const NARROW = { width: 1500, height: 2160, serverScale: 2 }
const SMALL = { width: 800, height: 600, serverScale: 1 }

describe('computeScale', () => {
  it.each(CASES)('$width x $height at server scale $serverScale gives $expected', ({ width, height, serverScale, expected }) => {
    expect(computeScale(width, height, serverScale)).toBeCloseTo(expected, PRECISION)
  })

  it('caps by the radial height share', () => {
    expect(computeScale(TALL.width, TALL.height, TALL.serverScale)).toBeCloseTo((RADIAL_MAX_HEIGHT_SHARE * TALL.height) / RADIAL_DIAMETER, PRECISION)
  })

  it('caps by the column width share', () => {
    expect(computeScale(NARROW.width, NARROW.height, NARROW.serverScale)).toBeCloseTo((COLUMN_MAX_WIDTH_SHARE * NARROW.width) / COLUMN_WIDTH, PRECISION)
  })

  it('lets the floor win over the cap', () => {
    expect(computeScale(SMALL.width, SMALL.height, SMALL.serverScale)).toBe(SCALE_FLOOR)
  })

  describe('non-finite inputs', () => {
    const base = { width: 1920, height: 1080, serverScale: 1 }
    const BAD_VALUES = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
    const FIELDS = ['width', 'height', 'serverScale'] as const

    for (const field of FIELDS) {
      it.each(BAD_VALUES)(`returns the floor when ${field} is %f`, (bad) => {
        const input = { ...base, [field]: bad }
        expect(computeScale(input.width, input.height, input.serverScale)).toBe(SCALE_FLOOR)
      })
    }
  })
})
