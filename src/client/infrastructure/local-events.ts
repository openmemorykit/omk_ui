import type { ValueOf } from '@openmemorykit/core/shared'
import type { LocalEvents } from '../application/ports'
import { guardedNativeCall, type NativeFailureHandler } from './guarded-native-call'

export const LocalEventName = { Ready: 'omk_ui:ready' } as const
export type LocalEventName = ValueOf<typeof LocalEventName>

export function createLocalEvents(onFailure: NativeFailureHandler): LocalEvents {
  return {
    emitReady: () => {
      guardedNativeCall(onFailure, `emit ${LocalEventName.Ready}`, () => emit(LocalEventName.Ready), undefined)
    },
  }
}
