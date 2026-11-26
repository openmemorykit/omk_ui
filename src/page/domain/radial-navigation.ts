import { RADIAL_MAX_CHILDREN, RADIAL_MAX_SECTORS, type RadialLeaf } from '@openmemorykit/ui/contract'
import type { InputSource, StickEvent } from '../../protocol/intents'
import type { OwnedRadialEntry } from '../../protocol/owned'
import { aimedChild, aimedSector, entersSubring } from './radial-geometry'
import { RadialLevel, type RadialState } from './ui-state'

const FIRST_INDEX = 0

const isList = <Element>(value: readonly Element[] | undefined): value is readonly Element[] => Array.isArray(value)

export function boundedEntries(entries: readonly OwnedRadialEntry[]): readonly OwnedRadialEntry[] {
  return isList(entries) ? entries.slice(FIRST_INDEX, RADIAL_MAX_SECTORS) : []
}

export function childrenOf(owned: OwnedRadialEntry | undefined): readonly RadialLeaf[] {
  const children = owned?.entry.children
  return isList(children) ? children.slice(FIRST_INDEX, RADIAL_MAX_CHILDREN) : []
}

export function clampIndex(index: number, count: number): number {
  if (count === 0 || !Number.isInteger(index)) return FIRST_INDEX
  return Math.min(Math.max(index, FIRST_INDEX), count - 1)
}

export function withRadialEntries(radial: RadialState, entries: readonly OwnedRadialEntry[]): RadialState {
  const bounded = boundedEntries(entries)
  const sectorIndex = clampIndex(radial.sectorIndex, bounded.length)
  const children = childrenOf(bounded[sectorIndex])
  const keepsChildren = radial.level === RadialLevel.Children && radial.childIndex !== null && children.length > 0
  return {
    entries: bounded,
    sectorIndex,
    level: keepsChildren ? RadialLevel.Children : RadialLevel.Sectors,
    childIndex: keepsChildren && radial.childIndex !== null ? clampIndex(radial.childIndex, children.length) : null,
  }
}

export function stepRadial(radial: RadialState, step: number): RadialState {
  const count = radial.entries.length
  if (count === 0) return radial
  if (radial.level === RadialLevel.Sectors) {
    const sectorIndex = (((radial.sectorIndex + step) % count) + count) % count
    return sectorIndex === radial.sectorIndex ? radial : { ...radial, sectorIndex }
  }
  const children = childrenOf(radial.entries[radial.sectorIndex])
  const childIndex = clampIndex((radial.childIndex ?? FIRST_INDEX) + step, children.length)
  return childIndex === radial.childIndex ? radial : { ...radial, childIndex }
}

export function enterChildren(radial: RadialState): RadialState {
  if (radial.level === RadialLevel.Children || childrenOf(radial.entries[radial.sectorIndex]).length === 0) return radial
  return { ...radial, level: RadialLevel.Children, childIndex: FIRST_INDEX }
}

export function leaveChildren(radial: RadialState): RadialState {
  return radial.level === RadialLevel.Sectors ? radial : { ...radial, level: RadialLevel.Sectors, childIndex: null }
}

function aimedChildState(radial: RadialState, vector: StickEvent): RadialState | null {
  if (radial.level !== RadialLevel.Children) return null
  const children = childrenOf(radial.entries[radial.sectorIndex])
  const childIndex = aimedChild(vector, radial.sectorIndex, radial.entries.length, children.length)
  if (childIndex === null) return null
  return childIndex === radial.childIndex ? radial : { ...radial, childIndex }
}

function sameRadial(first: RadialState, second: RadialState): boolean {
  return first.level === second.level && first.sectorIndex === second.sectorIndex && first.childIndex === second.childIndex
}

export function aimRadial(radial: RadialState, vector: StickEvent, source: InputSource): RadialState {
  const count = radial.entries.length
  const onChild = aimedChildState(radial, vector)
  if (onChild !== null) return onChild
  const sectorIndex = aimedSector(vector, count)
  if (sectorIndex === null) return radial
  const children = childrenOf(radial.entries[sectorIndex])
  const entersChildren = children.length > 0 && entersSubring(vector, source)
  const childIndex = entersChildren ? clampIndex(aimedChild(vector, sectorIndex, count, children.length) ?? FIRST_INDEX, children.length) : null
  const aimed = { ...radial, level: entersChildren ? RadialLevel.Children : RadialLevel.Sectors, sectorIndex, childIndex }
  return sameRadial(aimed, radial) ? radial : aimed
}
