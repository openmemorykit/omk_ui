import * as v from 'valibot'

export type OwnStrictObjectSchema<Entries extends v.ObjectEntries> = v.SchemaWithPipe<readonly [v.CustomSchema<unknown, undefined>, v.StrictObjectSchema<Entries, undefined>]>

export function isPlainObject(input: unknown): input is object {
  if (typeof input !== 'object' || input === null) return false
  const prototype: unknown = Object.getPrototypeOf(input)
  return prototype === Object.prototype || prototype === null
}

export function ownKeysWithin(allowedKeys: readonly string[]): v.CustomSchema<unknown, undefined> {
  const allowed = new Set(allowedKeys)
  return v.custom<unknown>((input) => isPlainObject(input) && Object.keys(input).every((key) => allowed.has(key)))
}

export function ownStrictObject<const Entries extends v.ObjectEntries>(entries: Entries): OwnStrictObjectSchema<Entries> {
  return v.pipe(ownKeysWithin(Object.keys(entries)), v.strictObject(entries))
}
