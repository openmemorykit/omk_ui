import { hasOwnKey } from '@openmemorykit/core/shared'

const CONTAINER_BRACKETS_BYTES = 2
const STRING_QUOTES_BYTES = 2
const SEPARATOR_BYTES = 1
const KEY_COLON_BYTES = 1
const NULL_BYTES = 4
const BOOLEAN_BYTES = 5
const SINGLE_BYTE_BELOW = 0x80
const DOUBLE_BYTE_BELOW = 0x800
const CONTROL_BELOW = 0x20
const QUOTE_CODE = 0x22
const BACKSLASH_CODE = 0x5c
const HIGH_SURROGATE_FIRST = 0xd800
const HIGH_SURROGATE_LAST = 0xdbff
const LOW_SURROGATE_FIRST = 0xdc00
const LOW_SURROGATE_LAST = 0xdfff
const ESCAPED_CONTROL_BYTES = 6
const ESCAPED_SIGN_BYTES = 2
const DOUBLE_BYTES = 2
const TRIPLE_BYTES = 3
const QUADRUPLE_BYTES = 4

const NOT_READABLE = Symbol('notReadable')

interface Child {
  readonly key: string | null
  readonly value: unknown
}

interface Frame {
  readonly container: object
  readonly children: Iterator<Child>
}

function isHighSurrogate(unit: number): boolean {
  return unit >= HIGH_SURROGATE_FIRST && unit <= HIGH_SURROGATE_LAST
}

function isLowSurrogate(unit: number): boolean {
  return unit >= LOW_SURROGATE_FIRST && unit <= LOW_SURROGATE_LAST
}

function unitBytes(unit: number): number {
  if (unit < CONTROL_BELOW || isHighSurrogate(unit) || isLowSurrogate(unit)) return ESCAPED_CONTROL_BYTES
  if (unit === QUOTE_CODE || unit === BACKSLASH_CODE) return ESCAPED_SIGN_BYTES
  if (unit < SINGLE_BYTE_BELOW) return 1
  return unit < DOUBLE_BYTE_BELOW ? DOUBLE_BYTES : TRIPLE_BYTES
}

function textBytes(text: string, room: number): number {
  if (text.length > room) return room + 1
  let bytes = STRING_QUOTES_BYTES
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index)
    const pairsWithNext = isHighSurrogate(unit) && isLowSurrogate(text.charCodeAt(index + 1))
    bytes += pairsWithNext ? QUADRUPLE_BYTES : unitBytes(unit)
    if (pairsWithNext) index += 1
  }
  return bytes
}

function ownValue(record: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  return descriptor !== undefined && hasOwnKey(descriptor, 'value') ? descriptor.value : NOT_READABLE
}

function* itemsOf(list: readonly unknown[]): Generator<Child> {
  for (let index = 0; index < list.length; index += 1) yield { key: null, value: ownValue(list, String(index)) }
}

function* propertiesOf(record: object): Generator<Child> {
  for (const key of Object.keys(record)) yield { key, value: ownValue(record, key) }
}

function childrenOf(container: object): Iterator<Child> {
  return Array.isArray(container) ? itemsOf(container as readonly unknown[]) : propertiesOf(container)
}

function scalarBytes(value: unknown, room: number): number | null {
  if (typeof value === 'string') return textBytes(value, room)
  if (typeof value === 'number') return Number.isFinite(value) ? String(value).length : NULL_BYTES
  if (typeof value === 'boolean') return BOOLEAN_BYTES
  if (typeof value === 'bigint') return null
  return value === null ? NULL_BYTES : 0
}

function isWalkable(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

function nextChild(path: Frame[], onPath: Set<object>): Child | undefined {
  for (let top = path[path.length - 1]; top !== undefined; top = path[path.length - 1]) {
    const step = top.children.next()
    if (step.done !== true) return step.value
    path.pop()
    onPath.delete(top.container)
  }
  return undefined
}

function enter(current: unknown, path: Frame[], onPath: Set<object>): boolean {
  if (!isWalkable(current)) return true
  if (onPath.has(current)) return false
  onPath.add(current)
  path.push({ container: current, children: childrenOf(current) })
  return true
}

export function measureCallBytes(value: unknown, maxBytes: number): number | null {
  const path: Frame[] = []
  const onPath = new Set<object>()
  let used = 0
  let separator = 0
  for (let next: Child | undefined = { key: null, value }; next !== undefined; next = nextChild(path, onPath)) {
    const room = maxBytes - used
    const keyBytes = next.key === null ? 0 : textBytes(next.key, room) + KEY_COLON_BYTES
    const ownBytes = isWalkable(next.value) ? CONTAINER_BRACKETS_BYTES : scalarBytes(next.value, room)
    if (next.value === NOT_READABLE || ownBytes === null || !enter(next.value, path, onPath)) return null
    used += separator + keyBytes + ownBytes
    separator = SEPARATOR_BYTES
    if (used > maxBytes) return maxBytes + 1
  }
  return used
}
