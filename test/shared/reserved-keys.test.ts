import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { isNamespaceOwner } from '../../src/protocol/namespaced-id'
import { JsonObjectSchema } from '../../src/shared/report/json-value'
import { RESERVED_OBJECT_KEYS } from '../../src/shared/reserved-keys'

const PROTOTYPE_PROPERTY = 'prototype'

const objectWithOwnKey = (key: string): unknown => ({ [key]: 1 })

describe('reserved object keys', () => {
  it('lists every name an object inherits, plus prototype', () => {
    expect([...RESERVED_OBJECT_KEYS].sort()).toEqual([...Object.getOwnPropertyNames(Object.prototype), PROTOTYPE_PROPERTY].sort())
  })

  it.each([...RESERVED_OBJECT_KEYS])('refuses %s as an owner and as a report key', (key) => {
    expect(isNamespaceOwner(key)).toBe(false)
    expect(v.safeParse(JsonObjectSchema, objectWithOwnKey(key)).success).toBe(false)
  })
})
