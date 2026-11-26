import { IDENTIFIER_PATTERN } from '@openmemorykit/ui/contract'

export const NAMESPACE_SEPARATOR = '/'
export const OWNER_MAX_LENGTH = 64
export const LOCAL_ID_MAX_LENGTH = 64
export const NAMESPACED_ID_MAX_LENGTH = OWNER_MAX_LENGTH + NAMESPACE_SEPARATOR.length + LOCAL_ID_MAX_LENGTH

const PROTOTYPE_PROPERTY = 'prototype'
const RESERVED_LOCAL_IDS: ReadonlySet<string> = new Set(['constructor', PROTOTYPE_PROPERTY, '__proto__'])
const RESERVED_OWNERS: ReadonlySet<string> = new Set([...Object.getOwnPropertyNames(Object.prototype), PROTOTYPE_PROPERTY])

export interface NamespacedParts {
  readonly owner: string
  readonly localId: string
}

export function isNamespaceOwner(owner: string): boolean {
  return (
    typeof owner === 'string'
    && owner.length > 0
    && owner.length <= OWNER_MAX_LENGTH
    && !owner.includes(NAMESPACE_SEPARATOR)
    && !RESERVED_OWNERS.has(owner)
  )
}

function isLocalId(localId: string): boolean {
  return localId.length <= LOCAL_ID_MAX_LENGTH && IDENTIFIER_PATTERN.test(localId) && !RESERVED_LOCAL_IDS.has(localId)
}

export function namespaceId(owner: string, localId: string): string {
  if (!isNamespaceOwner(owner) || !isLocalId(localId)) throw new RangeError('An owner or local id cannot be namespaced without ambiguity')
  return `${owner}${NAMESPACE_SEPARATOR}${localId}`
}

export function splitNamespacedId(namespacedId: string): NamespacedParts | null {
  if (typeof namespacedId !== 'string' || namespacedId.length > NAMESPACED_ID_MAX_LENGTH) return null
  const separatorAt = namespacedId.indexOf(NAMESPACE_SEPARATOR)
  if (separatorAt < 0) return null
  const owner = namespacedId.slice(0, separatorAt)
  const localId = namespacedId.slice(separatorAt + NAMESPACE_SEPARATOR.length)
  return isNamespaceOwner(owner) && isLocalId(localId) ? { owner, localId } : null
}
