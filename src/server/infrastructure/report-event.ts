import { createFivemServerTransport } from '@openmemorykit/core/server'
import { isPlayerSource } from '@openmemorykit/core/shared'
import { NetEvent } from '../../shared/net/net-events'
import { runGuarded, type FailureHandler } from './guarded-call'

export type ReportHandler = (source: number, raw: unknown) => void

export function registerReportEvent(report: ReportHandler, onFailure: FailureHandler): void {
  createFivemServerTransport().onFromClient(NetEvent.Report, (raw, source) => {
    if (isPlayerSource(source)) runGuarded(() => report(source, raw), onFailure)
  })
}
