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

const FORBIDDEN_KEYS = ['__proto__', 'constructor'] as const

function isPlainObject(input: unknown): input is object {
  if (typeof input !== 'object' || input === null) return false
  const prototype: unknown = Object.getPrototypeOf(input)
  return prototype === Object.prototype || prototype === null
}

const hasForbiddenKey = (input: object): boolean => FORBIDDEN_KEYS.some((key) => Object.prototype.hasOwnProperty.call(input, key))
const isContainer = (input: unknown): input is object => typeof input === 'object' && input !== null
const isAcceptedObject = (input: unknown): input is object => isPlainObject(input) && !hasForbiddenKey(input)

function containerSchema(input: unknown, accepted: v.GenericSchema<unknown, JsonValue>): v.GenericSchema<unknown, JsonValue> {
  return isAcceptedObject(input) ? accepted : WrongTypeSchema
}

function levelSchema(below: v.GenericSchema<unknown, JsonValue>): v.GenericSchema<unknown, JsonValue> {
  const arraySchema = v.array(below, JsonIssue.WrongType)
  const objectSchema = v.record(v.string(), below, JsonIssue.WrongType)
  return v.lazy((input) => {
    if (Array.isArray(input)) return arraySchema
    return isContainer(input) ? containerSchema(input, objectSchema) : scalarSchema(input)
  })
}

function deepContainerSchema(input: object): v.GenericSchema<unknown, never> {
  return Array.isArray(input) || isAcceptedObject(input) ? TooLargeSchema : WrongTypeSchema
}

const levelZero: v.GenericSchema<unknown, JsonValue> = v.lazy((input) => (isContainer(input) ? deepContainerSchema(input) : scalarSchema(input)))

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
  return isAcceptedObject(input) ? objectBranch : WrongTypeSchema
})
