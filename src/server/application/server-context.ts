import type { ServerPorts } from './ports'
import { ReportIntake } from './report-intake'
import { createServerLog, type ServerLog } from './server-log'
import { SnapshotRequests } from './snapshot-requests'
import { TraceSessions } from './trace-sessions'

export interface ServerContext {
  readonly ports: ServerPorts
  readonly kitVersion: string
  readonly log: ServerLog
  readonly traces: TraceSessions
  readonly intake: ReportIntake
  readonly snapshots: SnapshotRequests
  nextAskId(): number
}

export function createServerContext(ports: ServerPorts, kitVersion: string): ServerContext {
  let lastAskId = 0
  return {
    ports,
    kitVersion,
    log: createServerLog(ports),
    traces: new TraceSessions(),
    intake: new ReportIntake(),
    snapshots: new SnapshotRequests(),
    nextAskId() {
      lastAskId += 1
      return lastAskId
    },
  }
}
