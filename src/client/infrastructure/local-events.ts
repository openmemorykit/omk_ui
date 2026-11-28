import type { ValueOf } from '@openmemorykit/core/shared'
import type { LocalEvents } from '../application/ports'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

export const LocalEventName = { Ready: 'omk_ui:ready' } as const
export type LocalEventName = ValueOf<typeof LocalEventName>

export function createLocalEvents(onFailure: FailureHandler): LocalEvents {
  return {
    emitReady: () => {
      guardedCall(onFailure, `emit ${LocalEventName.Ready}`, () => emit(LocalEventName.Ready), undefined)
    },
  }
}
