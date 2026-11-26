import * as v from 'valibot'
import { JsonObjectSchema } from './json-value'
import { ReportKind } from './report-kind'

export const ReportEnvelopeSchema = v.strictObject({
  kind: v.picklist(Object.values(ReportKind)),
  at: v.pipe(v.number(), v.integer(), v.minValue(0)),
  data: JsonObjectSchema,
})
export type ReportEnvelope = v.InferOutput<typeof ReportEnvelopeSchema>
