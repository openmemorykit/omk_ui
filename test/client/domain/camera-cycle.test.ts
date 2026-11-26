import { describe, expect, it } from 'vitest'
import { DEFAULT_CAMERA_CYCLE, nextCameraMode } from '../../../src/client/domain/camera-cycle'
import { CameraViewMode } from '../../../src/shared/config/camera-view-mode'

const { ThirdPersonNear, ThirdPersonMedium, ThirdPersonFar, Cinematic, FirstPerson } = CameraViewMode

describe('nextCameraMode', () => {
  it('defaults to the four skippable views', () => {
    expect(DEFAULT_CAMERA_CYCLE).toEqual([ThirdPersonNear, ThirdPersonMedium, ThirdPersonFar, FirstPerson])
  })

  it('walks the whole cycle and wraps', () => {
    expect(nextCameraMode(ThirdPersonNear, DEFAULT_CAMERA_CYCLE, [])).toBe(ThirdPersonMedium)
    expect(nextCameraMode(ThirdPersonMedium, DEFAULT_CAMERA_CYCLE, [])).toBe(ThirdPersonFar)
    expect(nextCameraMode(ThirdPersonFar, DEFAULT_CAMERA_CYCLE, [])).toBe(FirstPerson)
    expect(nextCameraMode(FirstPerson, DEFAULT_CAMERA_CYCLE, [])).toBe(ThirdPersonNear)
  })

  it('skips configured views', () => {
    expect(nextCameraMode(ThirdPersonFar, DEFAULT_CAMERA_CYCLE, [FirstPerson])).toBe(ThirdPersonNear)
    expect(nextCameraMode(ThirdPersonNear, DEFAULT_CAMERA_CYCLE, [ThirdPersonMedium, ThirdPersonFar])).toBe(FirstPerson)
  })

  it('leaves the cinematic view for the first allowed one', () => {
    expect(nextCameraMode(Cinematic, DEFAULT_CAMERA_CYCLE, [])).toBe(ThirdPersonNear)
  })

  it('keeps the current view when everything is skipped', () => {
    expect(nextCameraMode(ThirdPersonFar, DEFAULT_CAMERA_CYCLE, [...DEFAULT_CAMERA_CYCLE])).toBe(ThirdPersonFar)
    expect(nextCameraMode(ThirdPersonFar, [], [])).toBe(ThirdPersonFar)
  })

  it('never returns the cinematic view, even from a cycle that contains it', () => {
    const cycle = [ThirdPersonNear, Cinematic, FirstPerson]
    expect(nextCameraMode(ThirdPersonNear, cycle, [])).toBe(FirstPerson)
    expect(nextCameraMode(FirstPerson, [Cinematic], [])).toBe(FirstPerson)
  })

  it('follows another cycle', () => {
    const cycle = [FirstPerson, ThirdPersonFar]
    expect(nextCameraMode(FirstPerson, cycle, [])).toBe(ThirdPersonFar)
    expect(nextCameraMode(ThirdPersonFar, cycle, [])).toBe(FirstPerson)
  })
})
