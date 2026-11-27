import { CameraViewMode } from '../../shared/config/camera-view-mode'
import type { CameraPort } from '../application/ports'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

const FALLBACK_CONTEXT = 0
const KNOWN_VIEW_MODES: readonly number[] = Object.values(CameraViewMode)

function toViewMode(raw: number): CameraViewMode {
  const known = KNOWN_VIEW_MODES.find((mode) => mode === raw)
  return known === undefined ? CameraViewMode.ThirdPersonNear : (known as CameraViewMode)
}

export function createCameraPort(onFailure: FailureHandler): CameraPort {
  return {
    context: () => guardedCall(onFailure, 'camera.context', () => GetCamActiveViewModeContext(), FALLBACK_CONTEXT),
    read: (context) => guardedCall(onFailure, 'camera.read', () => toViewMode(GetCamViewModeForContext(context)), CameraViewMode.ThirdPersonNear),
    write(context, mode) {
      guardedCall(onFailure, 'camera.write', () => SetCamViewModeForContext(context, mode), undefined)
    },
  }
}
