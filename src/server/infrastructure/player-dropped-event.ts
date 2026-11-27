import { isPlayerSource } from '@openmemorykit/core/shared'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

export const PLAYER_DROPPED_EVENT = 'playerDropped'

function eventSource(): number {
  return Number((globalThis as { readonly source?: unknown }).source)
}

export function registerPlayerDropped(playerDropped: (source: number) => void, onFailure: FailureHandler): void {
  on(PLAYER_DROPPED_EVENT, () => {
    const source = eventSource()
    if (isPlayerSource(source)) guardedCall(onFailure, PLAYER_DROPPED_EVENT, () => playerDropped(source), undefined)
  })
}
