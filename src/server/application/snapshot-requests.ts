import type { ReportPayload } from '../../shared/report/report-envelope'
import type { ReportKind } from '../../shared/report/report-kind'

export const SNAPSHOT_TIMEOUT_MS = 3000

export type SnapshotPayload = ReportPayload<typeof ReportKind.Snapshot>
export type SnapshotPresenter = (snapshot: SnapshotPayload) => readonly string[]

export interface PendingSnapshot {
  readonly player: number
  readonly requestId: number
  readonly requestedAt: number
  readonly present: SnapshotPresenter
  readonly reply: (line: string) => void
}

function isWithinTimeout(entry: PendingSnapshot, now: number): boolean {
  return Number.isFinite(now) && now - entry.requestedAt <= SNAPSHOT_TIMEOUT_MS
}

export class SnapshotRequests {
  private readonly pending = new Map<number, PendingSnapshot>()
  private lastRequestId = 0

  get trackedCount(): number {
    return this.pending.size
  }

  open(player: number, now: number, present: SnapshotPresenter, reply: (line: string) => void): number {
    this.lastRequestId += 1
    this.pending.set(player, { player, requestId: this.lastRequestId, requestedAt: now, present, reply })
    return this.lastRequestId
  }

  isPending(player: number, now: number): boolean {
    const entry = this.pending.get(player)
    return entry !== undefined && isWithinTimeout(entry, now)
  }

  take(player: number): PendingSnapshot | null {
    const entry = this.pending.get(player)
    this.pending.delete(player)
    return entry ?? null
  }

  expire(now: number): readonly PendingSnapshot[] {
    if (!Number.isFinite(now)) return []
    const expired = [...this.pending.values()].filter((entry) => !isWithinTimeout(entry, now))
    expired.forEach((entry) => this.pending.delete(entry.player))
    return expired
  }
}
