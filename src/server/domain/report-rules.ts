import { inspectShape, serializedByteLength, ShapeRefusal, type ShapeLimits, type ValueOf } from '@openmemorykit/core/shared'
import { safeParseReportEnvelope, type ReportEnvelope } from '../../shared/report/report-envelope'
import { ReportKind } from '../../shared/report/report-kind'

export const REPORT_MAX_BYTES = 2048
export const SNAPSHOT_MAX_BYTES = 8192
export const REPORT_SHAPE_LIMITS: ShapeLimits = Object.freeze({ maxDepth: 10, maxNodes: 4096 })

export const ReportDecision = { Accepted: 'accepted', NotTraced: 'notTraced', TooLarge: 'tooLarge', Invalid: 'invalid' } as const
export type ReportDecision = ValueOf<typeof ReportDecision>

export type ReportReading =
  | { readonly decision: typeof ReportDecision.Accepted; readonly report: ReportEnvelope }
  | { readonly decision: Exclude<ReportDecision, typeof ReportDecision.Accepted> }

const NOT_TRACED: ReportReading = Object.freeze({ decision: ReportDecision.NotTraced })
const TOO_LARGE: ReportReading = Object.freeze({ decision: ReportDecision.TooLarge })
const INVALID: ReportReading = Object.freeze({ decision: ReportDecision.Invalid })

const KIND_KEY = 'kind'

function isContainer(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

function isPlainObject(value: unknown): value is object {
  if (!isContainer(value)) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOwnKey(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function claimedKind(raw: object): unknown {
  if (!hasOwnKey(raw, KIND_KEY)) return undefined
  return (raw as Readonly<Record<string, unknown>>)[KIND_KEY]
}

function isWanted(kind: unknown, traceActive: boolean, snapshotPending: boolean): boolean {
  return kind === ReportKind.Snapshot ? snapshotPending : traceActive
}

function maxBytesFor(kind: unknown): number {
  return kind === ReportKind.Snapshot ? SNAPSHOT_MAX_BYTES : REPORT_MAX_BYTES
}

function containsTypedView(root: unknown): boolean {
  const pending: unknown[] = [root]
  while (pending.length > 0) {
    const current = pending.pop()
    if (ArrayBuffer.isView(current)) return true
    if (isContainer(current)) pending.push(...Object.values(current as Readonly<Record<string, unknown>>))
  }
  return false
}

function shapeReading(raw: object): ReportReading | null {
  const verdict = inspectShape(raw, REPORT_SHAPE_LIMITS)
  if (!verdict.ok) return verdict.refusal === ShapeRefusal.Nodes ? TOO_LARGE : INVALID
  if (containsTypedView(raw)) return INVALID
  return null
}

function sizeReading(raw: unknown, kind: unknown): ReportReading | null {
  const bytes = serializedByteLength(raw)
  if (bytes === null) return INVALID
  return bytes > maxBytesFor(kind) ? TOO_LARGE : null
}

function envelopeReading(raw: unknown): ReportReading {
  const parsed = safeParseReportEnvelope(raw)
  return parsed.success ? { decision: ReportDecision.Accepted, report: parsed.output } : INVALID
}

function readUnguarded(raw: unknown, traceActive: boolean, snapshotPending: boolean): ReportReading {
  if (!isPlainObject(raw)) return INVALID
  const kind = claimedKind(raw)
  if (!isWanted(kind, traceActive, snapshotPending)) return NOT_TRACED
  return shapeReading(raw) ?? sizeReading(raw, kind) ?? envelopeReading(raw)
}

export function readReport(raw: unknown, traceActive: boolean, snapshotPending: boolean): ReportReading {
  try {
    return readUnguarded(raw, traceActive, snapshotPending)
  } catch {
    return INVALID
  }
}
