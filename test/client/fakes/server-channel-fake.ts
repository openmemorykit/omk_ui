import type { ServerChannel } from '../../../src/client/application/ports'
import type { ReportEnvelope } from '../../../src/shared/report/report-envelope'

export interface ServerChannelFake extends ServerChannel {
  readonly reports: readonly ReportEnvelope[]
}

export function createServerChannelFake(): ServerChannelFake {
  const reports: ReportEnvelope[] = []
  return {
    report(envelope) {
      reports.push(envelope)
    },
    reports,
  }
}
