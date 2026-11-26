import { admitPlayerReport, drainIgnored, isSummaryDue, type PlayerReportState } from './report-limits'

export interface IgnoredSummary {
  readonly player: number
  readonly count: number
}

export class ReportIntake {
  private readonly players = new Map<number, PlayerReportState>()
  private summarizedAt = Number.NEGATIVE_INFINITY

  admit(player: number, now: number): boolean {
    const admission = admitPlayerReport(this.players.get(player), now)
    if (admission.state !== undefined) this.players.set(player, admission.state)
    return admission.allowed
  }

  takeIgnoredSummary(now: number): readonly IgnoredSummary[] {
    if (!isSummaryDue(this.summarizedAt, now)) return []
    const summaries: IgnoredSummary[] = []
    this.players.forEach((state, player) => {
      if (state.ignored === 0) return
      const drained = drainIgnored(state)
      this.players.set(player, drained.state)
      summaries.push({ player, count: drained.count })
    })
    if (summaries.length > 0) this.summarizedAt = now
    return summaries
  }

  forget(player: number): void {
    this.players.delete(player)
  }
}
