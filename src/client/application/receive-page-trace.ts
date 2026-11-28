import { hasOwnKey, isRecord } from '@openmemorykit/core/shared'
import { FromPage, type FromPageMessageOf } from '../../protocol/from-page'
import { safeParseReportEnvelope } from '../../shared/report/report-envelope'
import { ReportKind } from '../../shared/report/report-kind'
import { printLimitedLine } from './limited-console'
import { isAuthenticPageCallback } from './page-link'
import { ONE_LINE_PER_MINUTE_MS, traceLine } from './trace'
import type { UseCaseContext } from './use-case-context'

const KIND_FIELD = 'kind' satisfies keyof FromPageMessageOf<typeof FromPage.Trace>
const DATA_FIELD = 'data' satisfies keyof FromPageMessageOf<typeof FromPage.Trace>
const KINDS_THE_PAGE_MAY_TRACE: ReadonlySet<unknown> = new Set([ReportKind.PanelPainted, ReportKind.FormTimeout])

function ownField(body: Readonly<Record<string, unknown>>, field: string): unknown {
  return hasOwnKey(body, field) ? body[field] : undefined
}

export function receivePageTrace(context: UseCaseContext, body: unknown): void {
  if (!isAuthenticPageCallback(context, FromPage.Trace, body)) return
  const kind = isRecord(body) ? ownField(body, KIND_FIELD) : undefined
  const envelope = isRecord(body) && KINDS_THE_PAGE_MAY_TRACE.has(kind) ? safeParseReportEnvelope({ kind, at: context.ports.clock.now(), data: ownField(body, DATA_FIELD) }) : null
  if (envelope === null || !envelope.success) {
    printLimitedLine(context, FromPage.Trace, ONE_LINE_PER_MINUTE_MS, 'unreadable page trace ignored')
    return
  }
  traceLine(context.ports, context.store, envelope.output)
}
