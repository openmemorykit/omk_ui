import { describe, expect, it } from 'vitest'
import { CONFIRMS_PER_OWNER, ContractErrorCode, MAX_REPORTED_ERRORS, OpenBlocker, STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import { PAGE_ERROR_STACK_MAX_BYTES } from '../../../src/protocol/from-page'
import { safeParseReportEnvelope } from '../../../src/shared/report/report-envelope'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { AskOutcome, SNAPSHOT_MAX_OWNERS } from '../../../src/shared/report/report-payloads'
import { PAYLOAD_SAMPLES, REPORT_AT, sampleReport } from '../../fixtures/reports'

const KINDS = Object.values(ReportKind)
const FRACTION = 1.5
const OWNER_USAGE = PAYLOAD_SAMPLES[ReportKind.Snapshot].owners[0]
const PANEL_ID = PAYLOAD_SAMPLES[ReportKind.StackChanged].panels[0]
const CONTRACT_ERROR = PAYLOAD_SAMPLES[ReportKind.ContractRefused].errors[0]
const UNKNOWN_VALUE = 'madeUp'
const PADDING = 'x'

function accepts(kind: ReportKind, data: unknown): boolean {
  return safeParseReportEnvelope({ kind, at: REPORT_AT, data }).success
}

function withData(kind: ReportKind, change: object): object {
  return { ...PAYLOAD_SAMPLES[kind], ...change }
}

describe('report payloads: every kind', () => {
  it.each(KINDS)('accepts the sample payload of %s and keeps it as is', (kind) => {
    const result = safeParseReportEnvelope(sampleReport(kind))
    expect(result.success).toBe(true)
    expect(result.success && result.output).toEqual(sampleReport(kind))
  })

  it.each(KINDS)('refuses an unknown key in the payload of %s', (kind) => {
    expect(accepts(kind, withData(kind, { extra: 1 }))).toBe(false)
  })

  it.each(KINDS)('refuses an own toString key in the payload of %s', (kind) => {
    expect(accepts(kind, withData(kind, { toString: 1 }))).toBe(false)
  })

  it.each(KINDS)('refuses an empty payload for %s', (kind) => {
    expect(accepts(kind, {})).toBe(false)
  })

  it('refuses the payload of one kind sent under another kind', () => {
    expect(accepts(ReportKind.TextEntry, PAYLOAD_SAMPLES[ReportKind.PagePaused])).toBe(false)
  })
})

describe('report payloads: fields', () => {
  it.each([
    ['a mode outside the vocabulary', ReportKind.ModeChanged, { to: UNKNOWN_VALUE }],
    ['a stack deeper than the limit', ReportKind.StackChanged, { panels: Array.from({ length: STACK_MAX_DEPTH + 1 }, () => PANEL_ID) }],
    ['a fractional command sequence', ReportKind.StackChanged, { appliedCommandSeq: FRACTION }],
    ['more errors than reported by a call', ReportKind.ContractRefused, { errors: Array.from({ length: MAX_REPORTED_ERRORS + 1 }, () => CONTRACT_ERROR) }],
    ['an error code outside the vocabulary', ReportKind.ContractRefused, { errors: [{ ...CONTRACT_ERROR, code: UNKNOWN_VALUE }] }],
    ['an open blocker outside the vocabulary', ReportKind.OpenRefused, { reason: UNKNOWN_VALUE }],
    ['a reply kind outside the vocabulary', ReportKind.ReplyUndelivered, { reply: UNKNOWN_VALUE }],
    ['a page error stack over its byte limit', ReportKind.PageError, { stack: PADDING.repeat(PAGE_ERROR_STACK_MAX_BYTES + 1) }],
    ['a negative silence', ReportKind.PageUnresponsive, { silentMs: -1 }],
    ['an infinite paint duration', ReportKind.PanelPainted, { durationMs: Number.POSITIVE_INFINITY }],
    ['a fractional view mode', ReportKind.CameraReplayed, { actual: FRACTION }],
    ['an empty owner', ReportKind.UnknownField, { owner: '' }],
    ['an ask outcome outside the vocabulary', ReportKind.ConfirmAsked, { outcome: UNKNOWN_VALUE }],
    ['a client view that is not an object', ReportKind.Snapshot, { client: [1] }],
    ['more owners than a snapshot lists', ReportKind.Snapshot, { owners: Array.from({ length: SNAPSHOT_MAX_OWNERS + 1 }, () => OWNER_USAGE) }],
    ['an owner over its confirm quota', ReportKind.Snapshot, { owners: [{ ...OWNER_USAGE, confirms: CONFIRMS_PER_OWNER + 1 }] }],
    ['an owner usage with an unknown key', ReportKind.Snapshot, { owners: [{ ...OWNER_USAGE, extra: 1 }] }],
  ])('refuses %s', (_name, kind, change) => {
    expect(accepts(kind, withData(kind, change))).toBe(false)
  })

  it('accepts a page error stack of exactly its byte limit', () => {
    expect(accepts(ReportKind.PageError, withData(ReportKind.PageError, { stack: PADDING.repeat(PAGE_ERROR_STACK_MAX_BYTES) }))).toBe(true)
  })

  it('accepts a focus report without reason', () => {
    const { focus, cursor, keepInput } = PAYLOAD_SAMPLES[ReportKind.FocusApplied]
    expect(accepts(ReportKind.FocusApplied, { focus, cursor, keepInput })).toBe(true)
  })

  it('accepts a snapshot that carries the page view', () => {
    expect(accepts(ReportKind.Snapshot, withData(ReportKind.Snapshot, { page: { ready: true } }))).toBe(true)
  })

  it.each([OpenBlocker.Cooldown, OpenBlocker.OtherNuiFocus, ContractErrorCode.Occupied])('accepts an ask refused for %s', (reason) => {
    expect(accepts(ReportKind.ConfirmAsked, withData(ReportKind.ConfirmAsked, { outcome: AskOutcome.Refused, reason }))).toBe(true)
  })

  it('refuses an ask refused for a reason outside both vocabularies', () => {
    expect(accepts(ReportKind.ConfirmAsked, withData(ReportKind.ConfirmAsked, { outcome: AskOutcome.Refused, reason: UNKNOWN_VALUE }))).toBe(false)
  })
})
