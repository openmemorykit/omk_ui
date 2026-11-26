import * as v from 'valibot'

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject
export interface JsonObject { readonly [key: string]: JsonValue }

export const JSON_MAX_DEPTH = 8

export const JsonIssue = { TooLarge: 'TooLarge', WrongType: 'WrongType' } as const

const refusing = (message: string): v.GenericSchema<unknown, never> => v.pipe(v.unknown(), v.check(() => false, message)) as unknown as v.GenericSchema<unknown, never>
const TooLargeSchema = refusing(JsonIssue.TooLarge)
const WrongTypeSchema = refusing(JsonIssue.WrongType)
const FiniteNumberSchema = v.pipe(v.number(), v.finite(JsonIssue.WrongType))

const scalarByType: Readonly<Record<string, v.GenericSchema<unknown, JsonValue>>> = {
  string: v.string(JsonIssue.WrongType),
  number: FiniteNumberSchema,
  boolean: v.boolean(JsonIssue.WrongType),
}

function scalarSchema(input: unknown): v.GenericSchema<unknown, JsonValue> {
  if (input === null) return v.null(JsonIssue.WrongType)
  return scalarByType[typeof input] ?? WrongTypeSchema
}

const isPlainContainer = (input: unknown): input is object => typeof input === 'object' && input !== null && !ArrayBuffer.isView(input)

function levelSchema(below: v.GenericSchema<unknown, JsonValue>): v.GenericSchema<unknown, JsonValue> {
  const arraySchema = v.array(below, JsonIssue.WrongType)
  const objectSchema = v.record(v.string(), below, JsonIssue.WrongType)
  return v.lazy((input) => {
    if (Array.isArray(input)) return arraySchema
    return isPlainContainer(input) ? objectSchema : scalarSchema(input)
  })
}

const levelZero: v.GenericSchema<unknown, JsonValue> = v.lazy((input) => (isPlainContainer(input) ? TooLargeSchema : scalarSchema(input)))

const levels: readonly v.GenericSchema<unknown, JsonValue>[] = Array.from({ length: JSON_MAX_DEPTH }).reduce<readonly v.GenericSchema<unknown, JsonValue>[]>(
  (built) => [...built, levelSchema(built[built.length - 1] ?? levelZero)],
  [levelZero],
)

function valueAtDepth(depth: number): v.GenericSchema<unknown, JsonValue> {
  return levels[depth] ?? levelZero
}

export const JsonValueSchema: v.GenericSchema<unknown, JsonValue> = valueAtDepth(JSON_MAX_DEPTH)

const objectBranch = v.record(v.string(), valueAtDepth(JSON_MAX_DEPTH - 1), JsonIssue.WrongType)
const emptyListBranch = v.pipe(v.tuple([], JsonIssue.WrongType), v.transform((): JsonObject => ({})))

export const JsonObjectSchema: v.GenericSchema<unknown, JsonObject> = v.lazy((input) => {
  if (Array.isArray(input)) return input.length === 0 ? emptyListBranch : WrongTypeSchema
  return isPlainContainer(input) ? objectBranch : WrongTypeSchema
})
