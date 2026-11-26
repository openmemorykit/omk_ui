import { fullBucket, takeTokens, type BucketSettings, type TokenBucket } from '../../shared/rate-limit/token-bucket'

export const PLAYER_REPORT_BUCKET: BucketSettings = Object.freeze({ capacity: 40, refillPerSecond: 20 })
export const IGNORED_SUMMARY_INTERVAL_MS = 1000
const REPORT_COST = 1

export interface ReportLimits {
  readonly buckets: Readonly<Record<number, TokenBucket>>
  readonly ignored: Readonly<Record<number, number>>
  readonly summarizedAt: number
}

export interface ReportAdmission {
  readonly limits: ReportLimits
  readonly allowed: boolean
}

export interface IgnoredSummary {
  readonly player: number
  readonly count: number
}

export interface IgnoredSummaries {
  readonly limits: ReportLimits
  readonly summaries: readonly IgnoredSummary[]
}

export const EMPTY_REPORT_LIMITS: ReportLimits = Object.freeze({ buckets: Object.freeze({}), ignored: Object.freeze({}), summarizedAt: Number.NEGATIVE_INFINITY })

function ownEntry<T>(record: Readonly<Record<number, T>>, player: number): T | undefined {
  return Object.prototype.hasOwnProperty.call(record, player) ? record[player] : undefined
}

function withoutPlayer<T>(record: Readonly<Record<number, T>>, player: number): Readonly<Record<number, T>> {
  const removedKey = String(player)
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== removedKey))
}

export function admitReport(limits: ReportLimits, player: number, now: number): ReportAdmission {
  if (!Number.isFinite(now)) return { limits, allowed: false }
  const bucket = ownEntry(limits.buckets, player) ?? fullBucket(PLAYER_REPORT_BUCKET, now)
  const taken = takeTokens(bucket, PLAYER_REPORT_BUCKET, REPORT_COST, now)
  const buckets = { ...limits.buckets, [player]: taken.bucket }
  if (taken.allowed) return { limits: { ...limits, buckets }, allowed: true }
  const ignored = { ...limits.ignored, [player]: (ownEntry(limits.ignored, player) ?? 0) + 1 }
  return { limits: { ...limits, buckets, ignored }, allowed: false }
}

function isSummaryDue(limits: ReportLimits, now: number): boolean {
  return Number.isFinite(now) && now - limits.summarizedAt >= IGNORED_SUMMARY_INTERVAL_MS
}

export function takeIgnoredSummary(limits: ReportLimits, now: number): IgnoredSummaries {
  if (!isSummaryDue(limits, now)) return { limits, summaries: [] }
  const summaries = Object.entries(limits.ignored).map(([player, count]): IgnoredSummary => ({ player: Number(player), count }))
  if (summaries.length === 0) return { limits, summaries }
  return { limits: { ...limits, ignored: {}, summarizedAt: now }, summaries }
}

export function forgetPlayer(limits: ReportLimits, player: number): ReportLimits {
  return { ...limits, buckets: withoutPlayer(limits.buckets, player), ignored: withoutPlayer(limits.ignored, player) }
}
