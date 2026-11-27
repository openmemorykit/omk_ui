import { describe, expect, it } from 'vitest'
import {
  aimedChild,
  aimedSector,
  CHILD_STEP_DEGREES,
  childCenterAngle,
  RADIAL_DEADZONE,
  RADIAL_HOLE_RADIUS,
  RADIAL_RING_OUTER,
  RADIAL_SUBRING_INNER,
  sectorCenterAngle,
  SUBRING_ENTRY_MAGNITUDE,
} from '../../../src/page/domain/radial-geometry'

const TWO = 2
const THREE = 3
const FOUR = 4
const FIVE = 5
const SIX = 6
const SEVEN = 7
const EIGHT = 8
const MINUS_THREE = -3
const MINUS_FIVE = -5
const TWO_AND_HALF = 2.5
const ONE_AND_HALF = 1.5
const QUARTER_TURN = 90
const THREE_QUARTERS_TURN = 270
const THIRD_TURN = 120
const SMALL_ANGLE = 0.01
const SMALL_MARGIN = 0.001

const FULL_TURN = 360
const MAGNITUDE = 0.8
const SECTOR_COUNTS = [THREE, FOUR, FIVE, SIX, SEVEN, EIGHT] as const

function vectorAt(angle: number, magnitude: number): { readonly x: number; readonly y: number } {
  const radians = (angle * Math.PI) / (FULL_TURN / TWO)
  return { x: Math.sin(radians) * magnitude, y: -Math.cos(radians) * magnitude }
}

describe('radial constants', () => {
  it('keeps the agreed values', () => {
    expect({ RADIAL_DEADZONE, SUBRING_ENTRY_MAGNITUDE, CHILD_STEP_DEGREES }).toEqual({ RADIAL_DEADZONE: 0.38, SUBRING_ENTRY_MAGNITUDE: 0.9, CHILD_STEP_DEGREES: 30 })
    expect({ RADIAL_HOLE_RADIUS, RADIAL_RING_OUTER, RADIAL_SUBRING_INNER }).toEqual({ RADIAL_HOLE_RADIUS: 132, RADIAL_RING_OUTER: 318, RADIAL_SUBRING_INNER: 330 })
  })
})

describe('sectorCenterAngle', () => {
  it('puts the first sector at the top and goes clockwise', () => {
    expect(sectorCenterAngle(0, FOUR)).toBe(0)
    expect(sectorCenterAngle(1, FOUR)).toBe(QUARTER_TURN)
    expect(sectorCenterAngle(THREE, FOUR)).toBe(THREE_QUARTERS_TURN)
    expect(sectorCenterAngle(1, THREE)).toBe(THIRD_TURN)
  })

  it('does not throw on invalid input', () => {
    expect(Number.isFinite(sectorCenterAngle(Number.NaN, FOUR))).toBe(true)
    expect(Number.isFinite(sectorCenterAngle(TWO, 0))).toBe(true)
    expect(Number.isFinite(sectorCenterAngle(Number.POSITIVE_INFINITY, Number.NaN))).toBe(true)
  })
})

describe('aimedSector', () => {
  it.each(SECTOR_COUNTS)('aims each center for %i entries', (count) => {
    for (let index = 0; index < count; index += 1) {
      expect(aimedSector(vectorAt(sectorCenterAngle(index, count), MAGNITUDE), count)).toBe(index)
    }
  })

  it.each(SECTOR_COUNTS)('sends an exact border to the next sector clockwise for %i entries', (count) => {
    const half = FULL_TURN / count / TWO
    for (let index = 0; index < count; index += 1) {
      const border = sectorCenterAngle(index, count) + half
      expect(aimedSector(vectorAt(border, MAGNITUDE), count)).toBe((index + 1) % count)
      expect(aimedSector(vectorAt(border - SMALL_ANGLE, MAGNITUDE), count)).toBe(index)
      expect(aimedSector(vectorAt(border + SMALL_ANGLE, MAGNITUDE), count)).toBe((index + 1) % count)
    }
  })

  it('handles the exact border on the axes for four entries', () => {
    expect(aimedSector({ x: 0.5, y: -0.5 }, FOUR)).toBe(1)
    expect(aimedSector({ x: 0.5, y: 0.5 }, FOUR)).toBe(TWO)
    expect(aimedSector({ x: -0.5, y: 0.5 }, FOUR)).toBe(THREE)
    expect(aimedSector({ x: -0.5, y: -0.5 }, FOUR)).toBe(0)
  })

  it('aims the wrap-around sector just left of the top', () => {
    expect(aimedSector({ x: -0.01, y: -0.8 }, FIVE)).toBe(0)
    expect(aimedSector({ x: -0.5, y: -0.6 }, EIGHT)).toBe(SEVEN)
  })

  it('returns null under the dead zone and aims at its edge', () => {
    expect(aimedSector({ x: 0, y: 0 }, FOUR)).toBeNull()
    expect(aimedSector({ x: 0, y: -(RADIAL_DEADZONE - SMALL_MARGIN) }, FOUR)).toBeNull()
    expect(aimedSector({ x: 0, y: -RADIAL_DEADZONE }, FOUR)).toBe(0)
  })

  it('accepts magnitudes beyond 1', () => {
    expect(aimedSector({ x: 0, y: MINUS_FIVE }, FOUR)).toBe(0)
    expect(aimedSector({ x: 1e308, y: -1e308 }, FOUR)).toBe(1)
  })

  it('returns null for non finite vectors', () => {
    expect(aimedSector({ x: Number.NaN, y: -1 }, FOUR)).toBeNull()
    expect(aimedSector({ x: 0, y: Number.NaN }, FOUR)).toBeNull()
    expect(aimedSector({ x: Number.MAX_VALUE, y: Number.MAX_VALUE }, FOUR)).toBeNull()
    expect(aimedSector({ x: Number.POSITIVE_INFINITY, y: 0 }, FOUR)).toBeNull()
    expect(aimedSector({ x: 0, y: Number.NEGATIVE_INFINITY }, FOUR)).toBeNull()
  })

  it('returns null for invalid counts', () => {
    for (const count of [0, MINUS_THREE, TWO_AND_HALF, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(aimedSector({ x: 0, y: -1 }, count)).toBeNull()
    }
  })
})

describe('childCenterAngle', () => {
  it('spreads children around the parent every THIRTY degrees', () => {
    expect(childCenterAngle(1, FOUR, 0, THREE)).toBe(QUARTER_TURN - CHILD_STEP_DEGREES)
    expect(childCenterAngle(1, FOUR, 1, THREE)).toBe(QUARTER_TURN)
    expect(childCenterAngle(1, FOUR, TWO, THREE)).toBe(QUARTER_TURN + CHILD_STEP_DEGREES)
    expect(childCenterAngle(0, FOUR, 0, TWO)).toBe(-CHILD_STEP_DEGREES / TWO)
    expect(childCenterAngle(0, FOUR, 1, TWO)).toBe(CHILD_STEP_DEGREES / TWO)
  })

  it('does not throw on invalid input', () => {
    expect(Number.isFinite(childCenterAngle(Number.NaN, 0, Number.NaN, 0))).toBe(true)
    expect(childCenterAngle(1, FOUR, 0, 0)).toBe(QUARTER_TURN)
    expect(childCenterAngle(1, FOUR, Number.NaN, THREE)).toBe(QUARTER_TURN)
  })
})

describe('aimedChild', () => {
  it('aims the children around their parent', () => {
    for (let child = 0; child < THREE; child += 1) {
      expect(aimedChild(vectorAt(childCenterAngle(1, FOUR, child, THREE), MAGNITUDE), 1, FOUR, THREE)).toBe(child)
    }
    expect(aimedChild(vectorAt(childCenterAngle(0, FOUR, 0, TWO), MAGNITUDE), 0, FOUR, TWO)).toBe(0)
    expect(aimedChild(vectorAt(childCenterAngle(0, FOUR, 1, TWO), MAGNITUDE), 0, FOUR, TWO)).toBe(1)
  })

  it('sends an exact border to the next child clockwise', () => {
    const border = QUARTER_TURN - CHILD_STEP_DEGREES / TWO
    expect(aimedChild(vectorAt(border, MAGNITUDE), 1, FOUR, THREE)).toBe(1)
    expect(aimedChild(vectorAt(border - SMALL_ANGLE, MAGNITUDE), 1, FOUR, THREE)).toBe(0)
    expect(aimedChild(vectorAt(border + CHILD_STEP_DEGREES, MAGNITUDE), 1, FOUR, THREE)).toBe(TWO)
  })

  it('returns null outside the fan, including its outer border', () => {
    expect(aimedChild(vectorAt(QUARTER_TURN + ONE_AND_HALF * CHILD_STEP_DEGREES, MAGNITUDE), 1, FOUR, THREE)).toBeNull()
    expect(aimedChild(vectorAt(QUARTER_TURN - ONE_AND_HALF * CHILD_STEP_DEGREES - SMALL_ANGLE, MAGNITUDE), 1, FOUR, THREE)).toBeNull()
    expect(aimedChild(vectorAt(THREE_QUARTERS_TURN, MAGNITUDE), 1, FOUR, THREE)).toBeNull()
  })

  it('works across the top of the circle', () => {
    expect(aimedChild(vectorAt(-CHILD_STEP_DEGREES, MAGNITUDE), 0, FOUR, THREE)).toBe(0)
    expect(aimedChild(vectorAt(FULL_TURN - CHILD_STEP_DEGREES, MAGNITUDE), 0, FOUR, THREE)).toBe(0)
    expect(aimedChild(vectorAt(CHILD_STEP_DEGREES, MAGNITUDE), 0, FOUR, THREE)).toBe(TWO)
  })

  it('sends every child border to the next child for many fans', () => {
    for (let parentCount = 1; parentCount <= EIGHT; parentCount += 1) {
      for (let parentIndex = 0; parentIndex < parentCount; parentIndex += 1) {
        for (let childCount = 1; childCount <= SIX; childCount += 1) {
          for (let child = 0; child < childCount; child += 1) {
            const border = childCenterAngle(parentIndex, parentCount, child, childCount) + CHILD_STEP_DEGREES / TWO
            expect(aimedChild(vectorAt(border, MAGNITUDE), parentIndex, parentCount, childCount)).toBe(child + 1 < childCount ? child + 1 : null)
          }
        }
      }
    }
  })

  it('returns null for non integer indexes and counts', () => {
    expect(aimedChild(vectorAt(sectorCenterAngle(ONE_AND_HALF, FOUR), MAGNITUDE), ONE_AND_HALF, FOUR, THREE)).toBeNull()
    expect(aimedChild({ x: 0, y: -1 }, 0, TWO_AND_HALF, THREE)).toBeNull()
    expect(aimedChild({ x: 0, y: -1 }, 0, FOUR, TWO_AND_HALF)).toBeNull()
    expect(aimedChild({ x: 0, y: -1 }, 0, 0, THREE)).toBeNull()
  })

  it('returns null under the dead zone, for non finite vectors and invalid counts', () => {
    expect(aimedChild({ x: 0, y: -0.1 }, 0, FOUR, THREE)).toBeNull()
    expect(aimedChild({ x: Number.NaN, y: Number.NaN }, 0, FOUR, THREE)).toBeNull()
    expect(aimedChild({ x: 0, y: Number.NEGATIVE_INFINITY }, 0, FOUR, THREE)).toBeNull()
    expect(aimedChild({ x: 0, y: -1 }, 0, FOUR, 0)).toBeNull()
    expect(aimedChild({ x: 0, y: -1 }, SEVEN, FOUR, THREE)).toBeNull()
    expect(aimedChild({ x: 0, y: -1 }, Number.NaN, FOUR, THREE)).toBeNull()
    expect(aimedChild({ x: 0, y: -1 }, 0, FOUR, Number.NaN)).toBeNull()
  })
})
