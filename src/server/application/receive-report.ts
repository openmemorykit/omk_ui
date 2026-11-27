import { ReportDecision, readReport } from '../domain/report-rules'
import type { SnapshotPayload } from './snapshot-requests'
import { ReportKind } from '../../shared/report/report-kind'
import type { ReportEnvelope } from '../../shared/report/report-envelope'
import { formatReportDetails } from './report-details'
import type { ServerContext } from './server-context'
import { prefixBlock, type LogKey } from './server-log'

export function flushExpiredSnapshots(context: ServerContext): void {
  const { translate } = context.log
  context.snapshots.expire(context.ports.clock.now()).forEach((entry) => {
    prefixBlock([translate('log.debug.noReply', { player: entry.player })]).forEach(entry.reply)
  })
}

export function printIgnoredReports(context: ServerContext, now: number): void {
  context.intake.takeIgnoredSummary(now).forEach((summary) => {
    context.log.printPlayer(summary.player, context.log.translate('log.intake.dropped', { count: summary.count }))
  })
}

function answerSnapshot(context: ServerContext, source: number, snapshot: SnapshotPayload): void {
  const pending = context.snapshots.take(source)
  if (pending !== null) prefixBlock(pending.present(snapshot)).forEach(pending.reply)
}

function printReport(context: ServerContext, source: number, report: ReportEnvelope): void {
  const key: LogKey = `log.report.${report.kind}`
  context.log.printPlayer(source, context.log.translate(key, { details: formatReportDetails(report.data) }))
}

function acceptReport(context: ServerContext, source: number, report: ReportEnvelope): void {
  if (report.kind === ReportKind.Snapshot) answerSnapshot(context, source, report.data)
  else printReport(context, source, report)
}

function refuseReport(context: ServerContext, source: number, decision: ReportDecision): void {
  if (decision === ReportDecision.Invalid) context.log.printStamped(context.log.translate('log.intake.invalid', { player: source }))
  if (decision === ReportDecision.TooLarge) context.log.printStamped(context.log.translate('log.intake.tooLarge', { player: source }))
}

export function receiveReport(context: ServerContext, source: number, raw: unknown): void {
  flushExpiredSnapshots(context)
  if (!context.ports.players.exists(source)) return
  const now = context.ports.clock.now()
  const admitted = context.intake.admit(source, now)
  printIgnoredReports(context, now)
  if (!admitted) return
  const reading = readReport(raw, context.traces.isActive(source), context.snapshots.isPending(source, now))
  if (reading.decision === ReportDecision.Accepted) acceptReport(context, source, reading.report)
  else refuseReport(context, source, reading.decision)
}
