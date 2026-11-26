import { inspectShape, serializedByteLength } from '@openmemorykit/core/shared'
import type { ReportKind } from '../../shared/report/report-kind'
import type { JsonObject } from '../../shared/report/json-value'

export const TRACE_CAPACITY = 100
export const TRACE_MAX_BYTES = 65_536
export const TRACE_LINE_MAX_BYTES = 2048
const TRACE_SHAPE_LIMITS = Object.freeze({ maxDepth: 10, maxNodes: 512 })

export interface TraceLine {
  readonly at: number
  readonly kind: ReportKind
  readonly data: JsonObject
}

export interface TraceBuffer {
  readonly lines: readonly TraceLine[]
  readonly totalBytes: number
}

export const EMPTY_TRACE: TraceBuffer = Object.freeze({ lines: Object.freeze([]), totalBytes: 0 })

interface TraceDrain {
  readonly lines: readonly TraceLine[]
  readonly buffer: TraceBuffer
}

function lineBytes(line: TraceLine): number | null {
  if (!Number.isFinite(line.at) || !inspectShape(line.data, TRACE_SHAPE_LIMITS).ok) return null
  const bytes = serializedByteLength(line)
  return bytes === null || bytes > TRACE_LINE_MAX_BYTES ? null : bytes
}

function lastOfKind(lines: readonly TraceLine[], kind: ReportKind): TraceLine | undefined {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index]?.kind === kind) return lines[index]
  }
  return undefined
}

function repeatsLast(buffer: TraceBuffer, line: TraceLine): boolean {
  const previous = lastOfKind(buffer.lines, line.kind)
  return previous !== undefined && JSON.stringify(previous.data) === JSON.stringify(line.data)
}

function measured(line: TraceLine): number {
  return serializedByteLength(line) ?? 0
}

export function appendTrace(buffer: TraceBuffer, line: TraceLine): TraceBuffer {
  const added = lineBytes(line)
  if (added === null || repeatsLast(buffer, line)) return buffer
  let dropped = 0
  let totalBytes = buffer.totalBytes + added
  while (buffer.lines.length - dropped >= TRACE_CAPACITY || totalBytes > TRACE_MAX_BYTES) {
    const oldest = buffer.lines[dropped]
    if (oldest === undefined) break
    totalBytes -= measured(oldest)
    dropped += 1
  }
  return { lines: [...buffer.lines.slice(dropped), line], totalBytes }
}

export function drainTrace(buffer: TraceBuffer): TraceDrain {
  return { lines: buffer.lines, buffer: EMPTY_TRACE }
}
