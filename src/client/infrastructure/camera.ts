import { CameraViewMode } from '../../shared/config/camera-view-mode'
import type { CameraPort } from '../application/ports'
import { guardNative, type FailureReporter } from './native-guard'

const FALLBACK_CONTEXT = 0
const KNOWN_VIEW_MODES: readonly number[] = Object.values(CameraViewMode)

function toViewMode(raw: number): CameraViewMode {
  const known = KNOWN_VIEW_MODES.find((mode) => mode === raw)
  return known === undefined ? CameraViewMode.ThirdPersonNear : (known as CameraViewMode)
}

export function createCameraPort(onFailure: FailureReporter): CameraPort {
  return {
    context: () => guardNative(onFailure, 'camera.context', FALLBACK_CONTEXT, () => GetCamActiveViewModeContext()),
    read: (context) => guardNative(onFailure, 'camera.read', CameraViewMode.ThirdPersonNear, () => toViewMode(GetCamViewModeForContext(context))),
    write(context, mode) {
      guardNative(onFailure, 'camera.write', undefined, () => SetCamViewModeForContext(context, mode))
    },
  }
}
