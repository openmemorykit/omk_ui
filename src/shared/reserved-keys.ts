const PROTOTYPE_PROPERTY = 'prototype'

export const RESERVED_OBJECT_KEYS: readonly string[] = Object.freeze([...Object.getOwnPropertyNames(Object.prototype), PROTOTYPE_PROPERTY])
