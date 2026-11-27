import { createPlayerDirectory } from '@openmemorykit/core/server'
import { isPlayerSource } from '@openmemorykit/core/shared'
import type { PlayerPort } from '../application/ports'

export function createPlayerPort(): PlayerPort {
  const directory = createPlayerDirectory()
  return {
    exists: (source) => isPlayerSource(source) && DoesPlayerExist(String(source)),
    list: () => directory.connected(),
  }
}
