import type { ValueOf } from '@openmemorykit/core/shared'

export const CameraViewMode = { ThirdPersonNear: 0, ThirdPersonMedium: 1, ThirdPersonFar: 2, Cinematic: 3, FirstPerson: 4 } as const
export type CameraViewMode = ValueOf<typeof CameraViewMode>

export const SKIPPABLE_CAMERA_MODES: readonly CameraViewMode[] = Object.freeze([
  CameraViewMode.ThirdPersonNear,
  CameraViewMode.ThirdPersonMedium,
  CameraViewMode.ThirdPersonFar,
  CameraViewMode.FirstPerson,
])
