import type { CameraPort } from '../../../src/client/application/ports'
import { CameraViewMode } from '../../../src/shared/config/camera-view-mode'
import type { PortCall } from '../../shared/fakes/port-call'

export const ON_FOOT_CONTEXT = 0

export interface CameraWrite {
  readonly context: number
  readonly mode: CameraViewMode
}

export interface CameraFake extends CameraPort {
  readonly calls: readonly PortCall<CameraPort>[]
  readonly writes: readonly CameraWrite[]
  setContext(context: number): void
  setMode(context: number, mode: CameraViewMode): void
}

export function createCameraFake(): CameraFake {
  const calls: PortCall<CameraPort>[] = []
  const writes: CameraWrite[] = []
  const modes = new Map<number, CameraViewMode>()
  let currentContext = ON_FOOT_CONTEXT
  return {
    context() {
      calls.push({ method: 'context', args: [] })
      return currentContext
    },
    read(context) {
      calls.push({ method: 'read', args: [context] })
      return modes.get(context) ?? CameraViewMode.ThirdPersonNear
    },
    write(context, mode) {
      calls.push({ method: 'write', args: [context, mode] })
      writes.push({ context, mode })
      modes.set(context, mode)
    },
    setContext(context) {
      currentContext = context
    },
    setMode(context, mode) {
      modes.set(context, mode)
    },
    calls,
    writes,
  }
}
