import type { IconName } from '@openmemorykit/ui/contract'
import type { OwnedRadialEntry } from '../../../protocol/owned'
import { childrenOf } from '../../domain/radial-navigation'
import { childCenterAngle, sectorCenterAngle } from '../../domain/radial-geometry'
import { RadialLevel, type UiState } from '../../domain/ui-state'
import { UiMode } from '../../../protocol/page-vocabulary'
import type { Translate } from '../../i18n/messages'

export interface RadialChildView {
  readonly id: string
  readonly label: string
  readonly icon: IconName
  readonly angle: number
  readonly aimed: boolean
}

export interface RadialSectorView extends RadialChildView {
  readonly hasChildren: boolean
  readonly parent: boolean
  readonly dimmed: boolean
}

export interface RadialCenterView {
  readonly icon: IconName
  readonly name: string
  readonly description: string
  readonly path: readonly string[]
}

export interface RadialView {
  readonly level: RadialLevel
  readonly sectors: readonly RadialSectorView[]
  readonly children: readonly RadialChildView[]
  readonly needleAngle: number
  readonly center: RadialCenterView
}

function sectorView(owned: OwnedRadialEntry, index: number, count: number, aimedIndex: number, inChildren: boolean): RadialSectorView {
  const { entry } = owned
  const isAimedSector = index === aimedIndex
  return {
    id: entry.id,
    label: entry.label,
    icon: entry.icon,
    angle: sectorCenterAngle(index, count),
    aimed: isAimedSector && !inChildren,
    hasChildren: childrenOf(owned).length > 0,
    parent: isAimedSector && inChildren,
    dimmed: inChildren && !isAimedSector,
  }
}

function centerOf(owned: OwnedRadialEntry, child: ReturnType<typeof childrenOf>[number] | undefined): RadialCenterView {
  if (child === undefined) {
    const { entry } = owned
    return { icon: entry.icon, name: entry.label, description: entry.description, path: [] }
  }
  return { icon: child.icon, name: child.label, description: child.description, path: [owned.entry.label] }
}

const radialViewOf = (state: UiState): RadialView | null => {
  const { radial } = state
  const owned = radial.entries[radial.sectorIndex]
  if (state.mode !== UiMode.Radial || owned === undefined) return null
  const count = radial.entries.length
  const leaves = childrenOf(owned)
  const inChildren = radial.level === RadialLevel.Children && leaves.length > 0
  const aimedChild = inChildren ? radial.childIndex : null
  const aimedLeaf = aimedChild === null ? undefined : leaves[aimedChild]
  const children = inChildren
    ? leaves.map((leaf, index) => ({
        id: leaf.id,
        label: leaf.label,
        icon: leaf.icon,
        angle: childCenterAngle(radial.sectorIndex, count, index, leaves.length),
        aimed: index === aimedChild,
      }))
    : []
  return {
    level: inChildren ? RadialLevel.Children : RadialLevel.Sectors,
    sectors: radial.entries.map((entry, index) => sectorView(entry, index, count, radial.sectorIndex, inChildren)),
    children,
    needleAngle: children.find((child) => child.aimed)?.angle ?? sectorCenterAngle(radial.sectorIndex, count),
    center: centerOf(owned, aimedLeaf),
  }
}

export const radialView: (state: UiState, translate: Translate) => RadialView | null = radialViewOf
