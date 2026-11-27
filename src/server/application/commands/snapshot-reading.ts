import { hasOwnKey, isPlainObject, type UnknownRecord } from '@openmemorykit/core/shared'

import { printable } from '../server-log'

export type Section = UnknownRecord | null

export function asSection(value: unknown): Section {
  return isPlainObject(value) ? value : null
}

function ownValue(section: Section, key: string): unknown {
  return section !== null && hasOwnKey(section, key) ? section[key] : undefined
}

export function sectionOf(section: Section, key: string): Section {
  return asSection(ownValue(section, key))
}

export function textOf(section: Section, key: string): string | null {
  const value = ownValue(section, key)
  return typeof value === 'string' ? printable(value) : null
}

export function numberOf(section: Section, key: string): number | null {
  const value = ownValue(section, key)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function flagOf(section: Section, key: string): boolean | null {
  const value = ownValue(section, key)
  return typeof value === 'boolean' ? value : null
}

export function listOf(section: Section, key: string): readonly unknown[] | null {
  const value = ownValue(section, key)
  return Array.isArray(value) ? (value as readonly unknown[]) : null
}

export function textsOf(section: Section, key: string): readonly string[] | null {
  const values = listOf(section, key)
  return values === null ? null : values.filter((value): value is string => typeof value === 'string').map(printable)
}
