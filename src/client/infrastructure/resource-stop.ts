import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

export const RESOURCE_STOP_EVENT = 'onResourceStop'
export const ResourceStopOperation = { Register: `register ${RESOURCE_STOP_EVENT}`, Event: RESOURCE_STOP_EVENT } as const

export interface ResourceStopHandlers {
  readonly onOtherResourceStopped: (name: string) => void
  readonly onSelfStopping: () => void
}

export function registerResourceStop(handlers: ResourceStopHandlers, onFailure: FailureHandler): void {
  guardedCall(onFailure, ResourceStopOperation.Register, () => {
    on(RESOURCE_STOP_EVENT, (stoppedName: unknown) => {
      if (typeof stoppedName !== 'string') return
      guardedCall(onFailure, ResourceStopOperation.Event, () => {
        if (stoppedName === GetCurrentResourceName()) handlers.onSelfStopping()
        else handlers.onOtherResourceStopped(stoppedName)
      }, undefined)
    })
  }, undefined)
}
