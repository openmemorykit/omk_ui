import { describe, expect, it } from 'vitest'
import { IconName, RADIAL_MAX_SECTORS } from '@openmemorykit/ui/contract'
import { radialView } from '../../../../src/page/application/views/radial-view'
import { childCenterAngle, sectorCenterAngle } from '../../../../src/page/domain/radial-geometry'
import { createInitialState, RadialLevel } from '../../../../src/page/domain/ui-state'
import { radialEntry, radialState, translate } from './helpers'

const MIN_SECTORS = 3
const SECTOR_COUNTS = Array.from({ length: RADIAL_MAX_SECTORS - MIN_SECTORS + 1 }, (_unused, index) => MIN_SECTORS + index)
const FOUR = 4
const THREE_CHILDREN = 3
const PARENT = 1
const LAST_CHILD = 2
const FAR_SECTOR = 5
const FOURTH = 3
const THIRD = 2
const FIRST_CHILD_ANGLE = 60
const THIRD_SECTOR_ANGLE = 180

const entriesOf = (count: number, childCountAt = -1, childCount = 0): ReturnType<typeof radialEntry>[] =>
  Array.from({ length: count }, (_unused, index) => radialEntry(`e${index}`, index === childCountAt ? childCount : 0))

describe('radialView', () => {
  it('is null outside the radial mode', () => {
    expect(radialView({ ...radialState(entriesOf(THREE_CHILDREN)), mode: createInitialState().mode }, translate)).toBeNull()
  })

  it('is null without entries', () => {
    expect(radialView(radialState([]), translate)).toBeNull()
  })

  it('is null when the aimed sector does not exist', () => {
    expect(radialView(radialState(entriesOf(THREE_CHILDREN), { sectorIndex: FAR_SECTOR }), translate)).toBeNull()
  })

  it.each(SECTOR_COUNTS)('lays out %i sectors with the geometry angles', (count) => {
    const view = radialView(radialState(entriesOf(count), { sectorIndex: 1 }), translate)
    expect(view?.sectors.map((sector) => sector.angle)).toEqual(Array.from({ length: count }, (_unused, index) => sectorCenterAngle(index, count)))
    expect(view?.sectors.map((sector) => sector.aimed)).toEqual(Array.from({ length: count }, (_unused, index) => index === 1))
    expect(view?.needleAngle).toBe(sectorCenterAngle(1, count))
    expect(view?.level).toBe(RadialLevel.Sectors)
  })

  it('describes a sector', () => {
    const view = radialView(radialState(entriesOf(FOUR)), translate)
    expect(view?.sectors[THIRD]).toEqual({
      id: 'e2',
      label: 'Entry e2',
      icon: IconName.Settings,
      angle: THIRD_SECTOR_ANGLE,
      aimed: false,
      hasChildren: false,
      parent: false,
      dimmed: false,
    })
  })

  it('shows the center of the aimed sector with an empty path', () => {
    const view = radialView(radialState(entriesOf(FOUR), { sectorIndex: FOURTH }), translate)
    expect(view?.center).toEqual({ icon: IconName.Settings, name: 'Entry e3', description: 'About e3', path: [] })
    expect(view?.children).toEqual([])
  })

  it('marks sectors that have children at level 1', () => {
    const view = radialView(radialState(entriesOf(FOUR, PARENT, THREE_CHILDREN)), translate)
    expect(view?.sectors.map((sector) => sector.hasChildren)).toEqual([false, true, false, false])
    expect(view?.sectors.some((sector) => sector.dimmed)).toBe(false)
  })

  it('marks the parent and dims the others at level 2', () => {
    const state = radialState(entriesOf(FOUR, PARENT, THREE_CHILDREN), { level: RadialLevel.Children, sectorIndex: PARENT, childIndex: LAST_CHILD })
    const view = radialView(state, translate)
    expect(view?.sectors.map((sector) => sector.parent)).toEqual([false, true, false, false])
    expect(view?.sectors.map((sector) => sector.dimmed)).toEqual([true, false, true, true])
    expect(view?.sectors.map((sector) => sector.aimed)).toEqual([false, false, false, false])
  })

  it('lists the children of the parent with their angles and the aimed one at level 2', () => {
    const state = radialState(entriesOf(FOUR, PARENT, THREE_CHILDREN), { level: RadialLevel.Children, sectorIndex: PARENT, childIndex: LAST_CHILD })
    const view = radialView(state, translate)
    expect(view?.children.map((child) => child.angle)).toEqual(Array.from({ length: THREE_CHILDREN }, (_unused, index) => index).map((index) => childCenterAngle(PARENT, FOUR, index, THREE_CHILDREN)))
    expect(view?.children.map((child) => child.aimed)).toEqual([false, false, true])
    expect(view?.children[0]).toEqual({ id: 'e1-c0', label: 'Leaf e1-c0', icon: IconName.Check, angle: FIRST_CHILD_ANGLE, aimed: false })
    expect(view?.needleAngle).toBe(childCenterAngle(PARENT, FOUR, LAST_CHILD, THREE_CHILDREN))
  })

  it('shows the aimed leaf in the center with the parent as path', () => {
    const state = radialState(entriesOf(FOUR, PARENT, THREE_CHILDREN), { level: RadialLevel.Children, sectorIndex: 1, childIndex: 0 })
    expect(radialView(state, translate)?.center).toEqual({ icon: IconName.Check, name: 'Leaf e1-c0', description: 'About e1-c0', path: ['Entry e1'] })
  })

  it('falls back on the parent when no child is aimed', () => {
    const state = radialState(entriesOf(FOUR, PARENT, THREE_CHILDREN), { level: RadialLevel.Children, sectorIndex: 1, childIndex: null })
    const view = radialView(state, translate)
    expect(view?.center.name).toBe('Entry e1')
    expect(view?.center.path).toEqual([])
    expect(view?.children.some((child) => child.aimed)).toBe(false)
    expect(view?.needleAngle).toBe(sectorCenterAngle(PARENT, FOUR))
  })

  it('treats level 2 on a sector without children as level 1 content', () => {
    const state = radialState(entriesOf(FOUR), { level: RadialLevel.Children, sectorIndex: 1, childIndex: 0 })
    const view = radialView(state, translate)
    expect(view?.children).toEqual([])
    expect(view?.level).toBe(RadialLevel.Sectors)
    expect(view?.sectors.some((sector) => sector.dimmed)).toBe(false)
    expect(view?.center.name).toBe('Entry e1')
    expect(view?.needleAngle).toBe(sectorCenterAngle(PARENT, FOUR))
  })
})
