import { describe, expect, it } from 'vitest'
import { CameraViewMode, SKIPPABLE_CAMERA_MODES } from '../../../src/shared/config/camera-view-mode'

const { ThirdPersonNear, ThirdPersonMedium, ThirdPersonFar, Cinematic, FirstPerson } = CameraViewMode

describe('CameraViewMode', () => {
  it('keeps the engine numbering', () => {
    expect(Object.values(CameraViewMode)).toEqual([ThirdPersonNear, ThirdPersonMedium, ThirdPersonFar, Cinematic, FirstPerson])
    expect(Object.values(CameraViewMode)).toEqual(Object.values(CameraViewMode).map((_mode, index) => index))
  })

  it('never lets the cinematic mode be skipped', () => {
    expect(SKIPPABLE_CAMERA_MODES).toEqual([ThirdPersonNear, ThirdPersonMedium, ThirdPersonFar, FirstPerson])
  })
})
