import { CameraViewMode } from '../../shared/config/camera-view-mode'

export const DEFAULT_CAMERA_CYCLE: readonly CameraViewMode[] = Object.freeze([
  CameraViewMode.ThirdPersonNear,
  CameraViewMode.ThirdPersonMedium,
  CameraViewMode.ThirdPersonFar,
  CameraViewMode.FirstPerson,
])

export function nextCameraMode(current: CameraViewMode, cycle: readonly CameraViewMode[], skipped: readonly CameraViewMode[]): CameraViewMode {
  const start = cycle.indexOf(current)
  const rotated = cycle.map((_mode, offset) => cycle[(start + 1 + offset + cycle.length) % cycle.length] as CameraViewMode)
  return rotated.find((candidate) => candidate !== CameraViewMode.Cinematic && !skipped.includes(candidate)) ?? current
}
