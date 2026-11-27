import { isPlayerSource } from '@openmemorykit/core/shared'
import { runGuarded, type FailureHandler } from './guarded-call'

export const PLAYER_DROPPED_EVENT = 'playerDropped'

function eventSource(): number {
  return Number((globalThis as { readonly source?: unknown }).source)
}

export function registerPlayerDropped(playerDropped: (source: number) => void, onFailure: FailureHandler): void {
  on(PLAYER_DROPPED_EVENT, () => {
    const source = eventSource()
    if (isPlayerSource(source)) runGuarded(() => playerDropped(source), onFailure)
  })
}
