import { isPlainObject } from '@openmemorykit/core/shared'
import * as v from 'valibot'

export type OwnStrictObjectSchema<Entries extends v.ObjectEntries> = v.SchemaWithPipe<readonly [v.CustomSchema<unknown, undefined>, v.StrictObjectSchema<Entries, undefined>]>

export { isPlainObject }

export function ownKeysWithin(allowedKeys: readonly string[]): v.CustomSchema<unknown, undefined> {
  const allowed = new Set(allowedKeys)
  return v.custom<unknown>((input) => isPlainObject(input) && Object.keys(input).every((key) => allowed.has(key)))
}

export function ownStrictObject<const Entries extends v.ObjectEntries>(entries: Entries): OwnStrictObjectSchema<Entries> {
  return v.pipe(ownKeysWithin(Object.keys(entries)), v.strictObject(entries))
}
