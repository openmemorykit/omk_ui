import type { ReportKind } from '../../shared/report/report-kind'
import type { JsonObject } from '../../shared/report/json-value'

export const TRACE_CAPACITY = 100
export const TRACE_MAX_BYTES = 65_536
export const TRACE_LINE_MAX_BYTES = 2048
export const TRACE_LINE_MAX_NODES = 512
export const TRACE_LINE_MAX_DEPTH = 10

const ONE_BYTE_LIMIT = 0x7f
const TWO_BYTE_LIMIT = 0x7ff
const TWO_BYTES = 2
const THREE_BYTES = 3
const HIGH_SURROGATE_START = 0xd800
const HIGH_SURROGATE_END = 0xdbff
const LOW_SURROGATE_START = 0xdc00
const LOW_SURROGATE_END = 0xdfff
const SURROGATE_PAIR_BYTES = 4

export interface TraceLine {
  readonly at: number
  readonly kind: ReportKind
  readonly data: JsonObject
}

export interface TraceBuffer {
  readonly lines: readonly TraceLine[]
  readonly sizes: readonly number[]
  readonly totalBytes: number
}

export const EMPTY_TRACE: TraceBuffer = Object.freeze({ lines: Object.freeze([]), sizes: Object.freeze([]), totalBytes: 0 })

interface TraceDrain {
  readonly lines: readonly TraceLine[]
  readonly buffer: TraceBuffer
}

class Budget {
  private nodes = 0

  constructor(private characters: number) {}

  spend(characters: number): boolean {
    this.nodes += 1
    this.characters += characters
    return this.nodes <= TRACE_LINE_MAX_NODES && this.characters <= TRACE_LINE_MAX_BYTES
  }
}

function isPlainObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function ownDataValues(value: object, keys: readonly string[], children: unknown[]): boolean {
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !('value' in descriptor)) return false
    children.push(descriptor.value)
  }
  return true
}

function childrenOf(value: object): readonly unknown[] | null {
  const isList = Array.isArray(value)
  if (isList ? value.length > TRACE_LINE_MAX_NODES : !isPlainObject(value)) return null
  const keys = isList ? Array.from({ length: value.length }, (_hole, index) => String(index)) : Object.keys(value)
  const children: unknown[] = []
  if (keys.length > TRACE_LINE_MAX_NODES || !ownDataValues(value, keys, children)) return null
  return isList ? children : keys.flatMap((key, index) => [key, children[index]])
}

function acceptable(value: unknown, depth: number, budget: Budget): boolean {
  if (typeof value === 'string') return budget.spend(value.length)
  if (value === null || typeof value === 'boolean') return budget.spend(0)
  if (typeof value === 'number') return Number.isFinite(value) && budget.spend(0)
  if (typeof value !== 'object' || depth >= TRACE_LINE_MAX_DEPTH || !budget.spend(0)) return false
  const children = childrenOf(value)
  return children !== null && children.every((child) => acceptable(child, depth + 1, budget))
}

function utf8Bytes(text: string): number {
  let bytes = 0
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code <= ONE_BYTE_LIMIT) bytes += 1
    else if (code <= TWO_BYTE_LIMIT) bytes += TWO_BYTES
    else if (code >= HIGH_SURROGATE_START && code <= HIGH_SURROGATE_END && index + 1 < text.length && text.charCodeAt(index + 1) >= LOW_SURROGATE_START && text.charCodeAt(index + 1) <= LOW_SURROGATE_END) {
      bytes += SURROGATE_PAIR_BYTES
      index += 1
    } else bytes += THREE_BYTES
  }
  return bytes
}

function deepFrozen<Value>(value: Value): Value {
  if (typeof value === 'object' && value !== null) Object.values(value).forEach(deepFrozen)
  return Object.freeze(value)
}

interface Snapshot {
  readonly line: TraceLine
  readonly bytes: number
}

function snapshotOf(line: TraceLine): Snapshot | null {
  try {
    if (!Number.isFinite(line.at) || typeof line.kind !== 'string' || !acceptable(line.data, 0, new Budget(line.kind.length))) return null
    const text = JSON.stringify({ at: line.at, kind: line.kind, data: line.data })
    const bytes = utf8Bytes(text)
    return bytes > TRACE_LINE_MAX_BYTES ? null : { line: deepFrozen(JSON.parse(text) as TraceLine), bytes }
  } catch {
    return null
  }
}

function repeatsLast(buffer: TraceBuffer, line: TraceLine): boolean {
  for (let index = buffer.lines.length - 1; index >= 0; index -= 1) {
    const previous = buffer.lines[index]
    if (previous?.kind === line.kind) return JSON.stringify(previous.data) === JSON.stringify(line.data)
  }
  return false
}

export function appendTrace(buffer: TraceBuffer, line: TraceLine): TraceBuffer {
  const snapshot = snapshotOf(line)
  if (snapshot === null || repeatsLast(buffer, snapshot.line)) return buffer
  let dropped = 0
  let totalBytes = buffer.totalBytes + snapshot.bytes
  while (buffer.lines.length - dropped >= TRACE_CAPACITY || totalBytes > TRACE_MAX_BYTES) {
    totalBytes -= buffer.sizes[dropped] ?? 0
    dropped += 1
    if (dropped >= buffer.lines.length) break
  }
  return { lines: [...buffer.lines.slice(dropped), snapshot.line], sizes: [...buffer.sizes.slice(dropped), snapshot.bytes], totalBytes }
}

export function drainTrace(buffer: TraceBuffer): TraceDrain {
  return { lines: buffer.lines, buffer: EMPTY_TRACE }
}
