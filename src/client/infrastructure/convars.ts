import type { ConvarSource } from '@openmemorykit/core/shared'
import { createFivemConvarSource } from '@openmemorykit/core/client'

export function createClientConvars(): ConvarSource {
  return createFivemConvarSource()
}
