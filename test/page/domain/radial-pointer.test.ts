import { describe, expect, it } from 'vitest'
import { InputSource } from '../../../src/protocol/intents'
import {
  entersSubring,
  needleAngle,
  pointerVector,
  RADIAL_HOLE_RADIUS,
  RADIAL_RING_OUTER,
  RADIAL_SUBRING_OUTER,
  RADIAL_SUBRING_INNER,
  SUBRING_ENTRY_MAGNITUDE,
} from '../../../src/page/domain/radial-geometry'

const TWO = 2
const TEN = 10
const QUARTER_TURN = 90
const HALF_TURN = 180
const THREE_QUARTERS_TURN = 270
const NEARLY_FULL_TURN = 359
const CENTER_X = 500
const CENTER_Y = 400
const BEYOND_RING = 424
const SMALL_ANGLE = 0.01
const SMALL_MARGIN = 0.001
const NEAR_PIXELS = 300
const FAR_PIXELS = 340

describe('entersSubring', () => {
  it('enters from a gamepad at 0.9 and not below', () => {
    expect(entersSubring({ x: 0, y: -SUBRING_ENTRY_MAGNITUDE }, InputSource.Pad)).toBe(true)
    expect(entersSubring({ x: 0, y: -(SUBRING_ENTRY_MAGNITUDE - SMALL_MARGIN) }, InputSource.Pad)).toBe(false)
    expect(entersSubring({ x: 0, y: -SUBRING_ENTRY_MAGNITUDE }, InputSource.Console)).toBe(true)
  })

  it('enters from the pointer only on the drawn sub-ring', () => {
    const scale = 1
    const near = pointerVector({ x: NEAR_PIXELS, y: 0 }, { x: 0, y: 0 }, scale)
    const far = pointerVector({ x: FAR_PIXELS, y: 0 }, { x: 0, y: 0 }, scale)
    const edge = pointerVector({ x: RADIAL_SUBRING_INNER, y: 0 }, { x: 0, y: 0 }, scale)
    expect(near && entersSubring(near, InputSource.Pointer)).toBe(false)
    expect(far && entersSubring(far, InputSource.Pointer)).toBe(true)
    expect(edge && entersSubring(edge, InputSource.Pointer)).toBe(true)
  })

  it('never enters from the keyboard or on non finite vectors', () => {
    expect(entersSubring({ x: 0, y: -1 }, InputSource.Keyboard)).toBe(false)
    expect(entersSubring({ x: Number.NaN, y: 1 }, InputSource.Pad)).toBe(false)
    expect(entersSubring({ x: Number.POSITIVE_INFINITY, y: 0 }, InputSource.Pointer)).toBe(false)
  })
})

describe('pointerVector', () => {
  const center = { x: CENTER_X, y: CENTER_Y }

  it('returns null inside the hole and a vector at its edge', () => {
    expect(pointerVector(center, center, 1)).toBeNull()
    expect(pointerVector({ x: CENTER_X + RADIAL_HOLE_RADIUS - SMALL_ANGLE, y: CENTER_Y }, center, 1)).toBeNull()
    expect(pointerVector({ x: CENTER_X + RADIAL_HOLE_RADIUS, y: CENTER_Y }, center, 1)).not.toBeNull()
  })

  it('gives magnitude 1 on the ring edge and does not cap beyond', () => {
    expect(pointerVector({ x: CENTER_X + RADIAL_RING_OUTER, y: CENTER_Y }, center, 1)).toEqual({ x: 1, y: 0 })
    const beyond = pointerVector({ x: CENTER_X + BEYOND_RING, y: CENTER_Y }, center, 1)
    expect(beyond?.x).toBeCloseTo(BEYOND_RING / RADIAL_RING_OUTER, TEN)
    expect(beyond?.x).toBeGreaterThan(1)
  })

  it('aims at nothing beyond the outer radius of the drawn ring', () => {
    const justOut = RADIAL_RING_OUTER + SMALL_ANGLE
    expect(pointerVector({ x: CENTER_X + RADIAL_RING_OUTER, y: CENTER_Y }, center, 1, RADIAL_RING_OUTER)).not.toBeNull()
    expect(pointerVector({ x: CENTER_X + justOut, y: CENTER_Y }, center, 1, RADIAL_RING_OUTER)).toBeNull()
    expect(pointerVector({ x: CENTER_X + justOut, y: CENTER_Y }, center, 1)).not.toBeNull()
    expect(pointerVector({ x: CENTER_X + RADIAL_SUBRING_OUTER + SMALL_ANGLE, y: CENTER_Y }, center, 1)).toBeNull()
    expect(pointerVector({ x: CENTER_X + RADIAL_SUBRING_OUTER * TWO, y: CENTER_Y }, center, TWO)).not.toBeNull()
    expect(pointerVector({ x: CENTER_X + RADIAL_SUBRING_OUTER, y: CENTER_Y + RADIAL_SUBRING_OUTER }, center, 1)).toBeNull()
  })

  it('keeps y negative toward the top', () => {
    expect(pointerVector({ x: CENTER_X, y: CENTER_Y - RADIAL_RING_OUTER }, center, 1)).toEqual({ x: 0, y: -1 })
  })

  it('applies the scale to the hole and the ring', () => {
    expect(pointerVector({ x: CENTER_X + RADIAL_HOLE_RADIUS, y: CENTER_Y }, center, TWO)).toBeNull()
    expect(pointerVector({ x: CENTER_X + RADIAL_RING_OUTER * TWO, y: CENTER_Y }, center, TWO)).toEqual({ x: 1, y: 0 })
  })

  it('returns null for non finite or invalid input', () => {
    expect(pointerVector({ x: Number.NaN, y: 0 }, center, 1)).toBeNull()
    expect(pointerVector({ x: Number.POSITIVE_INFINITY, y: 0 }, center, 1)).toBeNull()
    expect(pointerVector({ x: 900, y: CENTER_Y }, { x: Number.NaN, y: 0 }, 1)).toBeNull()
    expect(pointerVector({ x: 900, y: 400 }, center, Number.MIN_VALUE)).toBeNull()
    for (const scale of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(pointerVector({ x: 900, y: CENTER_Y }, center, scale)).toBeNull()
    }
  })
})

describe('needleAngle', () => {
  it('returns the angle clockwise from the top in [0, 360)', () => {
    expect(needleAngle({ x: 0, y: -1 })).toBe(0)
    expect(needleAngle({ x: 1, y: 0 })).toBe(QUARTER_TURN)
    expect(needleAngle({ x: 0, y: 1 })).toBe(HALF_TURN)
    expect(needleAngle({ x: -1, y: 0 })).toBe(THREE_QUARTERS_TURN)
    expect(needleAngle({ x: -0.001, y: -1 })).toBeGreaterThan(NEARLY_FULL_TURN)
  })

  it('returns null under the dead zone and for non finite vectors', () => {
    expect(needleAngle({ x: 0, y: 0 })).toBeNull()
    expect(needleAngle({ x: 0, y: -0.2 })).toBeNull()
    expect(needleAngle({ x: Number.NaN, y: 1 })).toBeNull()
    expect(needleAngle({ x: 1, y: Number.NEGATIVE_INFINITY })).toBeNull()
  })
})
