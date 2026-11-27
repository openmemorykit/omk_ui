import { createFivemServerTransport } from '@openmemorykit/core/server'
import { isPlayerSource } from '@openmemorykit/core/shared'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'
import { NetEvent } from '../../shared/net/net-events'

export type ReportHandler = (source: number, raw: unknown) => void

export function registerRawReportEvent(report: ReportHandler, onFailure: FailureHandler): void {
  createFivemServerTransport().onFromClient(NetEvent.Report, (raw, source) => {
    if (isPlayerSource(source)) guardedCall(onFailure, NetEvent.Report, () => report(source, raw), undefined)
  })
}
