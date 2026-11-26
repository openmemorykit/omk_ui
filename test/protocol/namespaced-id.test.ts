import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { IdentifierSchema } from '@openmemorykit/ui/contract'
import {
  isNamespaceOwner,
  LOCAL_ID_MAX_LENGTH,
  NAMESPACE_SEPARATOR,
  NAMESPACED_ID_MAX_LENGTH,
  namespaceId,
  OWNER_MAX_LENGTH,
  splitNamespacedId,
} from '../../src/protocol/namespaced-id'
import { FixtureOwner, HOSTILE_NAMESPACED_IDS } from '../fixtures/owned'

const NOT_A_STRING = 42

const longest = (length: number): string => 'a'.repeat(length)

describe('namespaceId', () => {
  it('prefixes the local id with its owner', () => {
    expect(NAMESPACE_SEPARATOR).toBe('/')
    expect(namespaceId(FixtureOwner.Whitelist, 'list')).toBe('whitelist/list')
  })

  it('keeps an owner name that is not a contract identifier', () => {
    expect(namespaceId('Esx_Garage-2.0', 'main')).toBe('Esx_Garage-2.0/main')
  })

  it.each([
    ['', 'list'],
    ['white/list', 'list'],
    [longest(OWNER_MAX_LENGTH + 1), 'list'],
    ['__proto__', 'list'],
    ['constructor', 'list'],
    ['toString', 'list'],
    [FixtureOwner.Whitelist, ''],
    [FixtureOwner.Whitelist, 'a/b'],
    [FixtureOwner.Whitelist, 'List'],
    [FixtureOwner.Whitelist, 'constructor'],
    [FixtureOwner.Whitelist, longest(LOCAL_ID_MAX_LENGTH + 1)],
  ])('throws for the owner %j and the local id %j, which would make an ambiguous id', (owner, localId) => {
    expect(() => namespaceId(owner, localId)).toThrow(RangeError)
  })

  it('accepts both segments at their longest', () => {
    const owner = longest(OWNER_MAX_LENGTH)
    const localId = longest(LOCAL_ID_MAX_LENGTH)
    const namespaced = namespaceId(owner, localId)
    expect(namespaced).toHaveLength(NAMESPACED_ID_MAX_LENGTH)
    expect(splitNamespacedId(namespaced)).toStrictEqual({ owner, localId })
  })
})

describe('splitNamespacedId', () => {
  it('cuts at the separator', () => {
    expect(splitNamespacedId('whitelist/list')).toStrictEqual({ owner: FixtureOwner.Whitelist, localId: 'list' })
  })

  it('is the inverse of namespaceId', () => {
    expect(splitNamespacedId(namespaceId(FixtureOwner.Garage, 'open-door'))).toStrictEqual({ owner: FixtureOwner.Garage, localId: 'open-door' })
  })

  it.each(HOSTILE_NAMESPACED_IDS.map((namespaced) => [namespaced]))('refuses %j', (namespaced) => {
    expect(splitNamespacedId(namespaced)).toBeNull()
  })

  it('refuses an id one character over the bound', () => {
    const namespaced = `${longest(OWNER_MAX_LENGTH)}/${longest(LOCAL_ID_MAX_LENGTH)}`
    expect(splitNamespacedId(namespaced)).not.toBeNull()
    expect(splitNamespacedId(`${namespaced}a`)).toBeNull()
  })

  it('refuses a value that is not a string', () => {
    expect(splitNamespacedId(NOT_A_STRING as unknown as string)).toBeNull()
    expect(splitNamespacedId(null as unknown as string)).toBeNull()
    expect(splitNamespacedId({ toString: () => 'whitelist/list' } as unknown as string)).toBeNull()
  })
})

describe('segment rules', () => {
  it('matches the contract identifier length', () => {
    expect(v.is(IdentifierSchema, longest(LOCAL_ID_MAX_LENGTH))).toBe(true)
    expect(v.is(IdentifierSchema, longest(LOCAL_ID_MAX_LENGTH + 1))).toBe(false)
  })

  it('accepts an owner made of any character but the separator', () => {
    expect(isNamespaceOwner('[esx]-garage.v2')).toBe(true)
    expect(isNamespaceOwner(longest(OWNER_MAX_LENGTH))).toBe(true)
    expect(isNamespaceOwner(longest(OWNER_MAX_LENGTH + 1))).toBe(false)
    expect(isNamespaceOwner('')).toBe(false)
    expect(isNamespaceOwner('a/b')).toBe(false)
  })

  it.each(['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty', 'valueOf'])('refuses the owner %j', (owner) => {
    expect(isNamespaceOwner(owner)).toBe(false)
  })
})
