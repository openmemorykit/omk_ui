import { fullBucket, takeTokens, type TokenBucket } from '../../shared/rate-limit/token-bucket'
import { PLAYER_REPORT_BUCKET } from '../../shared/report/report-bucket'

export const IGNORED_SUMMARY_INTERVAL_MS = 1000
const REPORT_COST = 1

export interface PlayerReportState {
  readonly bucket: TokenBucket
  readonly ignored: number
}

export interface PlayerAdmission {
  readonly state: PlayerReportState | undefined
  readonly allowed: boolean
}

export interface IgnoredDrain {
  readonly state: PlayerReportState
  readonly count: number
}

export function admitPlayerReport(state: PlayerReportState | undefined, now: number): PlayerAdmission {
  if (!Number.isFinite(now)) return { state, allowed: false }
  const bucket = state?.bucket ?? fullBucket(PLAYER_REPORT_BUCKET, now)
  const ignored = state?.ignored ?? 0
  const taken = takeTokens(bucket, PLAYER_REPORT_BUCKET, REPORT_COST, now)
  return { state: { bucket: taken.bucket, ignored: taken.allowed ? ignored : ignored + 1 }, allowed: taken.allowed }
}

export function isSummaryDue(summarizedAt: number, now: number): boolean {
  return Number.isFinite(now) && now - summarizedAt >= IGNORED_SUMMARY_INTERVAL_MS
}

export function drainIgnored(state: PlayerReportState): IgnoredDrain {
  return { state: { bucket: state.bucket, ignored: 0 }, count: state.ignored }
}
