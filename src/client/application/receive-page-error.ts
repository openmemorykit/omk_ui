import { hasOwnKey, isRecord } from '@openmemorykit/core/shared'
import { FromPage, type FromPageMessageOf } from '../../protocol/from-page'
import { safeParseReportEnvelope } from '../../shared/report/report-envelope'
import { ReportKind } from '../../shared/report/report-kind'
import { printLimitedLine } from './limited-console'
import { isAuthenticPageCallback } from './page-link'
import { ONE_LINE_PER_MINUTE_MS, traceLine } from './trace'
import type { UseCaseContext } from './use-case-context'

const MESSAGE_FIELD = 'message' satisfies keyof FromPageMessageOf<typeof FromPage.PageError>
const STACK_FIELD = 'stack' satisfies keyof FromPageMessageOf<typeof FromPage.PageError>

function ownField(body: Readonly<Record<string, unknown>>, field: string): unknown {
  return hasOwnKey(body, field) ? body[field] : undefined
}

export function receivePageError(context: UseCaseContext, body: unknown): void {
  if (!isAuthenticPageCallback(context, FromPage.PageError, body)) return
  const data = isRecord(body) ? { message: ownField(body, MESSAGE_FIELD), stack: ownField(body, STACK_FIELD) } : undefined
  const envelope = safeParseReportEnvelope({ kind: ReportKind.PageError, at: context.ports.clock.now(), data })
  if (!envelope.success) {
    printLimitedLine(context, FromPage.PageError, ONE_LINE_PER_MINUTE_MS, 'unreadable page error ignored')
    return
  }
  traceLine(context.ports, context.store, envelope.output)
}
