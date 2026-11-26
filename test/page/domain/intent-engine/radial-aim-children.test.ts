import { describe, expect, it } from 'vitest'
import { transition } from '../../../../src/page/domain/intent-engine'
import { PageCommandType } from '../../../../src/page/domain/page-commands'
import { handleRadial } from '../../../../src/page/domain/radial-handler'
import { childCenterAngle } from '../../../../src/page/domain/radial-geometry'
import { RadialLevel, type UiState } from '../../../../src/page/domain/ui-state'
import { Intent } from '../../../../src/protocol/intents'
import { ToPage } from '../../../../src/protocol/to-page'
import { OWNED_GARAGE_RADIAL_ENTRY, OWNED_WHITELIST_RADIAL_ENTRY } from '../../../fixtures/owned'
import { initial, NOW, OPEN_RADIAL, press, radialEntries, release, run } from './engine-helpers'

const THIRD_ENTRY = { owner: OWNED_GARAGE_RADIAL_ENTRY.owner, entry: { ...OWNED_GARAGE_RADIAL_ENTRY.entry, id: 'garage/third' } }
const TWO_SECTORS = [OWNED_WHITELIST_RADIAL_ENTRY, OWNED_GARAGE_RADIAL_ENTRY]
const THREE_SECTORS = [OWNED_WHITELIST_RADIAL_ENTRY, OWNED_GARAGE_RADIAL_ENTRY, THIRD_ENTRY]
const CHILD_COUNT = OWNED_WHITELIST_RADIAL_ENTRY.entry.children?.length ?? 0
const FIRST_CHILD = 0
const SECOND_CHILD = 1
const TIP = 0.8
const RIM = 1
const OUTSIDE_THE_FAN = 55
const HALF_TURN = 180

function vectorAt(degrees: number, magnitude: number): { readonly type: typeof ToPage.Stick; readonly x: number; readonly y: number } {
  const radians = (degrees * Math.PI) / HALF_TURN
  return { type: ToPage.Stick, x: Math.sin(radians) * magnitude, y: -Math.cos(radians) * magnitude }
}

function inSubRing(): UiState {
  return run(initial(), [radialEntries(TWO_SECTORS), OPEN_RADIAL, press(Intent.Up)]).state
}

describe('aiming inside the sub-ring', () => {
  it('has at least two children to aim at', () => {
    expect(CHILD_COUNT).toBeGreaterThan(SECOND_CHILD)
  })

  it('aims the child under the stick and stays in the sub-ring', () => {
    const aimed = transition(inSubRing(), vectorAt(childCenterAngle(0, TWO_SECTORS.length, SECOND_CHILD, CHILD_COUNT), TIP), NOW).state
    expect(aimed.radial).toMatchObject({ level: RadialLevel.Children, sectorIndex: 0, childIndex: SECOND_CHILD })
  })

  it('keeps the very same state when the stick stays on the aimed child', () => {
    const state = inSubRing()
    const next = transition(state, vectorAt(childCenterAngle(0, TWO_SECTORS.length, FIRST_CHILD, CHILD_COUNT), TIP), NOW).state
    expect(next.radial).toBe(state.radial)
  })
})

describe('pushing the stick to the rim of a sector with children', () => {
  it('enters the sub-ring on the first child when the angle is outside the fan', () => {
    const open = run(initial(), [radialEntries(THREE_SECTORS), OPEN_RADIAL]).state
    const next = transition(open, vectorAt(OUTSIDE_THE_FAN, RIM), NOW).state
    expect(next.radial).toMatchObject({ level: RadialLevel.Children, sectorIndex: 0, childIndex: FIRST_CHILD })
  })
})

describe('radial handler guards', () => {
  it('ignores a direction that is released', () => {
    const state = inSubRing()
    expect(handleRadial(state, release(Intent.Right), NOW)).toEqual({ state, effects: [] })
  })

  it('does not select from a sub-ring that has no aimed child', () => {
    const state = { ...inSubRing(), radial: { ...inSubRing().radial, childIndex: null } }
    expect(handleRadial(state, press(Intent.Confirm), NOW)).toEqual({ state, effects: [] })
  })

  it('ignores a pointer aim without vector', () => {
    const state = inSubRing()
    expect(handleRadial(state, { type: PageCommandType.PointerAim, vector: null }, NOW)).toEqual({ state, effects: [] })
  })
})
