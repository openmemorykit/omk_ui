import type { TraceLine } from '../../../src/client/domain/trace-buffer'
import type { JsonObject } from '../../../src/shared/report/json-value'
import { ReportKind } from '../../../src/shared/report/report-kind'

export function freeFormTraceLine(at: number, data: JsonObject, kind: ReportKind = ReportKind.ModeChanged): TraceLine {
  return { at, kind, data } as unknown as TraceLine
}
