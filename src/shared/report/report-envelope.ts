import * as v from 'valibot'
import { ownKeysWithin } from './own-strict-object'
import { ReportKind } from './report-kind'
import { ReportPayloadSchema } from './report-payloads'

type PayloadSchemas = typeof ReportPayloadSchema

const TimestampSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

type ReportSchemaOf<Kind extends ReportKind> = v.StrictObjectSchema<
  { readonly kind: v.LiteralSchema<Kind, undefined>; readonly at: typeof TimestampSchema; readonly data: PayloadSchemas[Kind] },
  undefined
>
type ReportSchemas = { readonly [Kind in ReportKind]: ReportSchemaOf<Kind> }

function reportSchemaOf<Kind extends ReportKind>(kind: Kind): ReportSchemaOf<Kind> {
  return v.strictObject({ kind: v.literal(kind), at: TimestampSchema, data: ReportPayloadSchema[kind] })
}

const REPORT_SCHEMAS = Object.values(ReportKind).map(reportSchemaOf) as readonly ReportSchemas[ReportKind][]
const ENVELOPE_KEYS: readonly string[] = Object.freeze(['kind', 'at', 'data'] satisfies readonly (keyof ReportSchemas[ReportKind]['entries'])[])

export const ReportEnvelopeSchema = v.pipe(ownKeysWithin(ENVELOPE_KEYS), v.variant('kind', REPORT_SCHEMAS))
export type ReportEnvelope = v.InferOutput<typeof ReportEnvelopeSchema>
export type ReportPayload<Kind extends ReportKind> = v.InferOutput<PayloadSchemas[Kind]>

export function safeParseReportEnvelope(input: unknown): v.SafeParseResult<typeof ReportEnvelopeSchema> {
  return v.safeParse(ReportEnvelopeSchema, input, { abortEarly: true })
}
