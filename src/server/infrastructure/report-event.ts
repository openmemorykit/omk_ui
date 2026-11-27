import { NetEvent } from '../../shared/net/net-events'
import { runGuarded, type FailureHandler } from './guarded-call'
import type { KitServerEvents } from './server-events'

export type ReportHandler = (source: number, raw: unknown) => void

export function registerReportEvent(events: KitServerEvents, report: ReportHandler, onFailure: FailureHandler): void {
  events.onFromClient(NetEvent.Report, (raw, source) => runGuarded(() => report(source, raw), onFailure))
}
